"use strict";

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

export class MapSettingsCard extends FormattingSettingsCard {
    minColor = new formattingSettings.ColorPicker({
        name: "minColor",
        displayName: "Cor Mínima",
        description: "Cor para os menores valores da métrica",
        value: { value: "#93C5FD" }
    });

    maxColor = new formattingSettings.ColorPicker({
        name: "maxColor",
        displayName: "Cor Máxima",
        description: "Cor para os maiores valores da métrica",
        value: { value: "#1E3A8A" }
    });

    emptyColor = new formattingSettings.ColorPicker({
        name: "emptyColor",
        displayName: "Cor Sem Dados",
        description: "Cor para províncias sem registros",
        value: { value: "#E2E8F0" }
    });

    borderColor = new formattingSettings.ColorPicker({
        name: "borderColor",
        displayName: "Cor da Borda",
        description: "Cor dos limites provinciais",
        value: { value: "#FFFFFF" }
    });

    borderWidth = new formattingSettings.NumUpDown({
        name: "borderWidth",
        displayName: "Espessura da Borda",
        description: "Espessura das linhas das províncias",
        value: 1.5
    });

    name: string = "mapSettings";
    displayName: string = "Cores do Mapa";
    slices: Array<FormattingSettingsSlice> = [
        this.minColor,
        this.maxColor,
        this.emptyColor,
        this.borderColor,
        this.borderWidth
    ];
}

export class DataLabelsCard extends FormattingSettingsCard {
    show = new formattingSettings.ToggleSwitch({
        name: "show",
        displayName: "Exibir Rótulos",
        description: "Exibir nomes das províncias sobre o mapa",
        value: true
    });

    showValues = new formattingSettings.ToggleSwitch({
        name: "showValues",
        displayName: "Exibir Valores",
        description: "Exibir o valor numérico abaixo do nome",
        value: false
    });

    color = new formattingSettings.ColorPicker({
        name: "color",
        displayName: "Cor do Texto",
        description: "Cor dos rótulos de dados",
        value: { value: "#1E293B" }
    });

    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize",
        displayName: "Tamanho da Fonte",
        description: "Tamanho da fonte dos rótulos",
        value: 9
    });

    name: string = "dataLabels";
    displayName: string = "Rótulos de Dados";
    slices: Array<FormattingSettingsSlice> = [
        this.show,
        this.showValues,
        this.color,
        this.fontSize
    ];
}

export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    mapSettings = new MapSettingsCard();
    dataLabels = new DataLabelsCard();

    cards = [this.mapSettings, this.dataLabels];
}
