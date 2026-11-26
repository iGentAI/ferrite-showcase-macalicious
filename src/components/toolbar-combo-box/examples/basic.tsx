import { ComboBoxItem } from "macalicious/combo-box";
import { ToolbarComboBox } from "macalicious/toolbar-combo-box";

export default function Basic() {
  return (
    <ToolbarComboBox aria-label="Font size" defaultValue="12">
      <ComboBoxItem>9</ComboBoxItem>
      <ComboBoxItem>10</ComboBoxItem>
      <ComboBoxItem>11</ComboBoxItem>
      <ComboBoxItem>12</ComboBoxItem>
      <ComboBoxItem>14</ComboBoxItem>
      <ComboBoxItem>18</ComboBoxItem>
      <ComboBoxItem>24</ComboBoxItem>
    </ToolbarComboBox>
  );
}
