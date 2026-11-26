import { StockList, StockRow } from "macalicious/stock-row";

const UP = [8.5, 8.52, 8.49, 8.55, 8.6, 8.58, 8.64, 8.7, 8.68, 8.71];
const DOWN = [8.7, 8.66, 8.69, 8.61, 8.58, 8.62, 8.57, 8.6, 8.63];

export default function States() {
  return (
    <StockList aria-label="States of a row" style={{ width: 330 }}>
      <StockRow
        symbol="GAIN"
        name="Up on the previous close"
        price="8.71"
        change="+0.20"
        direction="gain"
        data={UP}
        previousClose={8.51}
      />
      <StockRow
        symbol="LOSS"
        name="Down, 44% of the session gone"
        price="8.63"
        change="-0.08"
        direction="loss"
        data={DOWN}
        previousClose={8.71}
        progress={0.44}
      />
      <StockRow
        symbol="SEL"
        name="Selected"
        price="8.71"
        change="+0.20"
        direction="gain"
        data={UP}
        previousClose={8.51}
        selected
        onSelect={() => {}}
      />
      <StockRow
        symbol="FOCUS"
        name="Keyboard focus"
        price="8.71"
        change="+0.20"
        direction="gain"
        data={UP}
        previousClose={8.51}
        onSelect={() => {}}
        data-force="focus"
      />
      <StockRow symbol="NONE" name="No quote" price="--" change="--" direction="none" />
    </StockList>
  );
}
