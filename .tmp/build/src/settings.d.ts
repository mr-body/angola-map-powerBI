import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;
export declare class MapSettingsCard extends FormattingSettingsCard {
    minColor: formattingSettings.ColorPicker;
    maxColor: formattingSettings.ColorPicker;
    emptyColor: formattingSettings.ColorPicker;
    borderColor: formattingSettings.ColorPicker;
    borderWidth: formattingSettings.NumUpDown;
    name: string;
    displayName: string;
    slices: Array<FormattingSettingsSlice>;
}
export declare class DataLabelsCard extends FormattingSettingsCard {
    show: formattingSettings.ToggleSwitch;
    showValues: formattingSettings.ToggleSwitch;
    color: formattingSettings.ColorPicker;
    fontSize: formattingSettings.NumUpDown;
    name: string;
    displayName: string;
    slices: Array<FormattingSettingsSlice>;
}
export declare class VisualFormattingSettingsModel extends FormattingSettingsModel {
    mapSettings: MapSettingsCard;
    dataLabels: DataLabelsCard;
    cards: (MapSettingsCard | DataLabelsCard)[];
}
