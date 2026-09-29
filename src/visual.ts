"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import * as topojson from "topojson-client";
import { geoIdentity, geoPath, GeoPath, GeoPermissibleObjects } from "d3-geo";
import { select, Selection } from "d3-selection";
import { interpolateRgb } from "d3-interpolate";
import { FeatureCollection, Geometry, Feature } from "geojson";

import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import IVisualEventService = powerbi.extensibility.IVisualEventService;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ISelectionId = powerbi.visuals.ISelectionId;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import DataView = powerbi.DataView;

import { VisualFormattingSettingsModel } from "./settings";
import { angolaTopoJson } from "./angolaTopoJson";
import { ANGOLA_PROVINCES, findProvinceId, ProvinceInfo } from "./provinces";

interface ProvinceDataPoint {
    id: string;
    name: string;
    capital: string;
    value: number | null;
    formattedValue: string;
    selectionId: ISelectionId | null;
    feature: Feature<Geometry>;
    tooltips: VisualTooltipDataItem[];
}

export class Visual implements IVisual {
    private host: IVisualHost;
    private events: IVisualEventService;
    private selectionManager: ISelectionManager;
    private formattingSettingsService: FormattingSettingsService;
    private formattingSettings: VisualFormattingSettingsModel;

    private container: HTMLElement;
    private svg: Selection<SVGSVGElement, unknown, null, undefined>;
    private mapGroup: Selection<SVGGElement, unknown, null, undefined>;
    private pathsGroup: Selection<SVGGElement, unknown, null, undefined>;
    private labelsGroup: Selection<SVGGElement, unknown, null, undefined>;
    private legendContainer: HTMLElement;
    private legendTitle: HTMLElement;
    private legendBar: HTMLElement;
    private legendMin: HTMLElement;
    private legendMax: HTMLElement;

    private geoFeatures: FeatureCollection<Geometry>;
    private cachedSelectionIds: Map<string, ISelectionId> = new Map();

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.events = options.host.eventService;
        this.selectionManager = this.host.createSelectionManager();
        this.formattingSettingsService = new FormattingSettingsService();

        // Convert TopoJSON to GeoJSON once
        const topoData: any = angolaTopoJson;
        const angolaObject = topoData.objects.angola;
        this.geoFeatures = topojson.feature(topoData, angolaObject) as unknown as FeatureCollection<Geometry>;

        this.container = options.element;
        this.container.classList.add("angola-map-container");

        // SVG Root
        this.svg = select(this.container)
            .append("svg")
            .classed("angola-map-svg", true);

        // Map container group
        this.mapGroup = this.svg.append("g").classed("map-group", true);
        this.pathsGroup = this.mapGroup.append("g").classed("provinces-group", true);
        this.labelsGroup = this.mapGroup.append("g").classed("province-label-group", true);

        // Legend overlay container (using DOM elements without innerHTML)
        this.legendContainer = document.createElement("div");
        this.legendContainer.className = "map-legend";
        this.legendContainer.style.display = "none";

        this.legendTitle = document.createElement("div");
        this.legendTitle.className = "legend-title";
        this.legendContainer.appendChild(this.legendTitle);

        this.legendBar = document.createElement("div");
        this.legendBar.className = "legend-bar";
        this.legendContainer.appendChild(this.legendBar);

        const valuesRow = document.createElement("div");
        valuesRow.className = "legend-values";
        this.legendMin = document.createElement("span");
        this.legendMax = document.createElement("span");
        valuesRow.appendChild(this.legendMin);
        valuesRow.appendChild(this.legendMax);
        this.legendContainer.appendChild(valuesRow);

        this.container.appendChild(this.legendContainer);

        // Handle background click to clear selection
        this.svg.on("click", (event: MouseEvent) => {
            if (event.target === this.svg.node() || event.target === this.mapGroup.node()) {
                this.selectionManager.clear().then(() => {
                    this.applySelectionStyles([]);
                });
            }
        });

        // Handle context menu on background
        this.svg.on("contextmenu", (event: MouseEvent) => {
            if (event.target === this.svg.node() || event.target === this.mapGroup.node()) {
                event.preventDefault();
                this.selectionManager.showContextMenu({}, {
                    x: event.clientX,
                    y: event.clientY
                });
            }
        });
    }

    public update(options: VisualUpdateOptions) {
        this.events.renderingStarted(options);

        try {
            const dataViews = options.dataViews;
            this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(
                VisualFormattingSettingsModel,
                dataViews && dataViews[0]
            );

            const width = Math.max(50, options.viewport.width);
            const height = Math.max(50, options.viewport.height);

            this.svg
                .attr("width", width)
                .attr("height", height)
                .attr("viewBox", `0 0 ${width} ${height}`);

            // Projection setup
            const padding = Math.min(width, height) * 0.04;
            const projection = geoIdentity()
                .reflectY(true)
                .fitExtent(
                    [[padding, padding], [width - padding, height - padding]],
                    this.geoFeatures as GeoPermissibleObjects
                );

            const pathGenerator = geoPath().projection(projection);

            // Extract Data Points
            const { dataPoints, measureTitle, hasValues, minVal, maxVal } = this.extractData(dataViews ? dataViews[0] : null);

            // Color scale setup
            const minColor = this.formattingSettings.mapSettings.minColor.value.value || "#93C5FD";
            const maxColor = this.formattingSettings.mapSettings.maxColor.value.value || "#1E3A8A";
            const emptyColor = this.formattingSettings.mapSettings.emptyColor.value.value || "#E2E8F0";
            const borderColor = this.formattingSettings.mapSettings.borderColor.value.value || "#FFFFFF";
            const borderWidth = Number(this.formattingSettings.mapSettings.borderWidth.value) || 1.5;

            const colorInterpolator = interpolateRgb(minColor, maxColor);

            const getColor = (dp: ProvinceDataPoint | undefined): string => {
                if (!dp || dp.value === null || isNaN(dp.value) || minVal === null || maxVal === null) {
                    return emptyColor;
                }
                if (maxVal === minVal) {
                    return maxColor;
                }
                const ratio = Math.max(0, Math.min(1, (dp.value - minVal) / (maxVal - minVal)));
                return colorInterpolator(ratio);
            };

            // Render Provinces
            const paths = this.pathsGroup
                .selectAll<SVGPathElement, Feature<Geometry>>("path.province-path")
                .data(this.geoFeatures.features, (d) => String(d.properties?.id));

            paths.exit().remove();

            const pathsEnter = paths.enter()
                .append("path")
                .classed("province-path", true);

            const allPaths = pathsEnter.merge(paths);

            allPaths
                .attr("d", (d) => pathGenerator(d) || "")
                .attr("fill", (d) => {
                    const id = String(d.properties?.id);
                    const dp = dataPoints.get(id);
                    return getColor(dp);
                })
                .attr("stroke", borderColor)
                .attr("stroke-width", `${borderWidth}px`)
                .attr("data-id", (d) => String(d.properties?.id));

            // Tooltips and Interactivity
            allPaths
                .on("mouseover", (event: MouseEvent, d: Feature<Geometry>) => {
                    const id = String(d.properties?.id);
                    const dp = dataPoints.get(id);
                    const provinceInfo = ANGOLA_PROVINCES[id];
                    const displayName = provinceInfo ? provinceInfo.name : id;

                    const tooltipItems: VisualTooltipDataItem[] = dp?.tooltips && dp.tooltips.length > 0
                        ? dp.tooltips
                        : [
                            {
                                displayName: "Província",
                                value: displayName
                            },
                            {
                                displayName: measureTitle || "Valor",
                                value: dp?.formattedValue || "Sem dados"
                            }
                        ];

                    this.host.tooltipService.show({
                        dataItems: tooltipItems,
                        identities: dp?.selectionId ? [dp.selectionId] : [],
                        coordinates: [event.clientX, event.clientY],
                        isTouchEvent: false
                    });
                })
                .on("mousemove", (event: MouseEvent) => {
                    this.host.tooltipService.move({
                        dataItems: [],
                        identities: [],
                        coordinates: [event.clientX, event.clientY],
                        isTouchEvent: false
                    });
                })
                .on("mouseout", () => {
                    this.host.tooltipService.hide({
                        immediately: true,
                        isTouchEvent: false
                    });
                })
                .on("click", (event: MouseEvent, d: Feature<Geometry>) => {
                    const id = String(d.properties?.id);
                    const dp = dataPoints.get(id);
                    if (!dp || !dp.selectionId) return;

                    const isMultiSelect = event.ctrlKey || event.metaKey || event.shiftKey;
                    this.selectionManager.select(dp.selectionId, isMultiSelect).then((selectedIds: ISelectionId[]) => {
                        this.applySelectionStyles(selectedIds);
                    });
                    event.stopPropagation();
                })
                .on("contextmenu", (event: MouseEvent, d: Feature<Geometry>) => {
                    const id = String(d.properties?.id);
                    const dp = dataPoints.get(id);
                    event.preventDefault();
                    this.selectionManager.showContextMenu(
                        dp?.selectionId || {},
                        { x: event.clientX, y: event.clientY }
                    );
                    event.stopPropagation();
                });

            // Update selection state on reload
            const currentSelection = this.selectionManager.getSelectionIds() as ISelectionId[];
            this.applySelectionStyles(currentSelection || []);

            // Data Labels
            this.renderLabels(dataPoints, pathGenerator);

            // Legend
            this.renderLegend(measureTitle, minVal, maxVal, minColor, maxColor, hasValues);

            this.events.renderingFinished(options);
        } catch (error) {
            console.error("Error updating Angola map visual:", error);
            this.events.renderingFailed(options, String(error));
        }
    }

    private renderLabels(
        dataPoints: Map<string, ProvinceDataPoint>,
        pathGenerator: GeoPath<any, GeoPermissibleObjects>
    ) {
        const showLabels = this.formattingSettings.dataLabels.show.value;
        const showValues = this.formattingSettings.dataLabels.showValues.value;
        const labelColor = this.formattingSettings.dataLabels.color.value.value || "#1E293B";
        const fontSize = Number(this.formattingSettings.dataLabels.fontSize.value) || 9;

        if (!showLabels) {
            this.labelsGroup.selectAll("*").remove();
            return;
        }

        const labelFeatures = this.geoFeatures.features.filter((f) => {
            const centroid = pathGenerator.centroid(f);
            return !isNaN(centroid[0]) && !isNaN(centroid[1]);
        });

        const groups = this.labelsGroup
            .selectAll<SVGGElement, Feature<Geometry>>("g.label-item")
            .data(labelFeatures, (d) => String(d.properties?.id));

        groups.exit().remove();

        const groupsEnter = groups.enter().append("g").classed("label-item", true);
        const allGroups = groupsEnter.merge(groups);

        allGroups.attr("transform", (d) => {
            const centroid = pathGenerator.centroid(d);
            return `translate(${centroid[0]}, ${centroid[1]})`;
        });

        // Province Name Text
        allGroups.each(function (d) {
            const group = select(this);
            const id = String(d.properties?.id);
            const provinceInfo = ANGOLA_PROVINCES[id];
            const name = provinceInfo ? provinceInfo.name : id;
            const dp = dataPoints.get(id);

            let nameText = group.select<SVGTextElement>("text.province-label");
            if (nameText.empty()) {
                nameText = group.append("text").classed("province-label", true);
            }

            nameText
                .text(name)
                .attr("fill", labelColor)
                .attr("font-size", `${fontSize}px`)
                .attr("y", showValues && dp?.value !== null ? -fontSize * 0.5 : 0);

            let valueText = group.select<SVGTextElement>("text.province-value-label");
            if (showValues && dp && dp.value !== null) {
                if (valueText.empty()) {
                    valueText = group.append("text").classed("province-value-label", true);
                }
                valueText
                    .text(dp.formattedValue)
                    .attr("font-size", `${Math.max(7, fontSize - 1.5)}px`)
                    .attr("y", fontSize * 0.7);
            } else {
                valueText.remove();
            }
        });
    }

    private renderLegend(
        title: string,
        minVal: number | null,
        maxVal: number | null,
        minColor: string,
        maxColor: string,
        hasValues: boolean
    ) {
        if (!hasValues || minVal === null || maxVal === null) {
            this.legendContainer.style.display = "none";
            return;
        }

        this.legendContainer.style.display = "flex";
        this.legendTitle.textContent = title || "Métrica";
        this.legendBar.style.background = `linear-gradient(to right, ${minColor}, ${maxColor})`;
        this.legendMin.textContent = this.formatNumber(minVal);
        this.legendMax.textContent = this.formatNumber(maxVal);
    }

    private applySelectionStyles(selectedIds: ISelectionId[]) {
        const hasSelection = selectedIds && selectedIds.length > 0;

        this.pathsGroup.selectAll<SVGPathElement, Feature<Geometry>>("path.province-path")
            .classed("selected", (d) => {
                if (!hasSelection) return false;
                const id = String(d.properties?.id);
                return selectedIds.some((selId) => (selId as any).key === id || selId.equals(this.getSelectionIdForProvince(id)));
            })
            .classed("dimmed", (d) => {
                if (!hasSelection) return false;
                const id = String(d.properties?.id);
                const isSelected = selectedIds.some((selId) => (selId as any).key === id || selId.equals(this.getSelectionIdForProvince(id)));
                return !isSelected;
            });

        this.labelsGroup.selectAll<SVGGElement, Feature<Geometry>>("g.label-item")
            .selectAll("text")
            .classed("dimmed", (d) => {
                if (!hasSelection) return false;
                const id = String((d as any)?.properties?.id);
                const isSelected = selectedIds.some((selId) => (selId as any).key === id || selId.equals(this.getSelectionIdForProvince(id)));
                return !isSelected;
            });
    }

    private getSelectionIdForProvince(id: string): ISelectionId | null {
        return this.cachedSelectionIds.get(id) || null;
    }

    private extractData(dataView: DataView | null) {
        const dataPoints = new Map<string, ProvinceDataPoint>();
        this.cachedSelectionIds.clear();

        let measureTitle = "";
        let hasValues = false;
        let minVal: number | null = null;
        let maxVal: number | null = null;

        const categorical = dataView?.categorical;
        const categories = categorical?.categories;
        const values = categorical?.values;

        if (categories && categories.length > 0) {
            const categoryColumn = categories[0];
            const categoryValues = categoryColumn.values;

            const measureColumn = values && values.length > 0 ? values[0] : null;
            if (measureColumn) {
                measureTitle = measureColumn.source.displayName || "";
            }

            for (let i = 0; i < categoryValues.length; i++) {
                const rawCategory = categoryValues[i];
                const provinceId = findProvinceId(rawCategory as string);

                if (provinceId) {
                    const provinceInfo: ProvinceInfo = ANGOLA_PROVINCES[provinceId];
                    const rawVal = measureColumn ? (measureColumn.values[i] as number) : null;
                    const numVal = typeof rawVal === "number" && !isNaN(rawVal) ? rawVal : null;

                    let formattedVal = "";
                    if (numVal !== null) {
                        hasValues = true;
                        if (minVal === null || numVal < minVal) minVal = numVal;
                        if (maxVal === null || numVal > maxVal) maxVal = numVal;
                        formattedVal = this.formatNumber(numVal);
                    }

                    const selectionId = this.host
                        .createSelectionIdBuilder()
                        .withCategory(categoryColumn, i)
                        .createSelectionId();

                    this.cachedSelectionIds.set(provinceId, selectionId);

                    const tooltips: VisualTooltipDataItem[] = [
                        {
                            displayName: "Província",
                            value: provinceInfo ? provinceInfo.name : provinceId
                        }
                    ];

                    if (provinceInfo?.capital) {
                        tooltips.push({
                            displayName: "Capital",
                            value: provinceInfo.capital
                        });
                    }

                    if (measureColumn && numVal !== null) {
                        tooltips.push({
                            displayName: measureTitle,
                            value: formattedVal
                        });
                    }

                    // Extract additional tooltip measures if present
                    if (values && values.length > 1) {
                        for (let v = 1; v < values.length; v++) {
                            const extraValCol = values[v];
                            const extraRaw = extraValCol.values[i];
                            tooltips.push({
                                displayName: extraValCol.source.displayName,
                                value: typeof extraRaw === "number" ? this.formatNumber(extraRaw) : String(extraRaw ?? "")
                            });
                        }
                    }

                    const feature = this.geoFeatures.features.find((f) => f.properties?.id === provinceId)!;

                    dataPoints.set(provinceId, {
                        id: provinceId,
                        name: provinceInfo ? provinceInfo.name : provinceId,
                        capital: provinceInfo ? provinceInfo.capital : "",
                        value: numVal,
                        formattedValue: formattedVal,
                        selectionId,
                        feature,
                        tooltips
                    });
                }
            }
        }

        return { dataPoints, measureTitle, hasValues, minVal, maxVal };
    }

    private formatNumber(num: number): string {
        if (Math.abs(num) >= 1_000_000) {
            return (num / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + "M";
        }
        if (Math.abs(num) >= 1_000) {
            return (num / 1_000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + "k";
        }
        return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }
}