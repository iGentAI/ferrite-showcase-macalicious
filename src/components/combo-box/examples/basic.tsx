import { ComboBox, ComboBoxItem } from "macalicious/combo-box";

export default function Basic() {
  return (
    <ComboBox aria-label="Font size" defaultValue="12" style={{ width: 80 }}>
      <ComboBoxItem>9</ComboBoxItem>
      <ComboBoxItem>10</ComboBoxItem>
      <ComboBoxItem>11</ComboBoxItem>
      <ComboBoxItem>12</ComboBoxItem>
      <ComboBoxItem>14</ComboBoxItem>
      <ComboBoxItem>18</ComboBoxItem>
      <ComboBoxItem>24</ComboBoxItem>
    </ComboBox>
  );
}
