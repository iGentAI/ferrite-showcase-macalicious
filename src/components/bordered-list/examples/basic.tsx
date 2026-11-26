import { BorderedList, BorderedListRow, BorderedListRows } from "macalicious/bordered-list";
import { GradientButton } from "macalicious/gradient-button";
import { StatusDot } from "macalicious/status-dot";
import { useRef, useState } from "react";

/** A list of services with add and remove buttons. Click a row, then use the arrow keys. */
export default function Basic() {
  const next = useRef(1);
  const [services, setServices] = useState([
    { id: "wifi", name: "Wi-Fi", connected: true },
    { id: "bluetooth", name: "Bluetooth PAN", connected: false },
    { id: "bridge", name: "Thunderbolt Bridge", connected: false },
  ]);
  const [selected, setSelected] = useState<readonly string[]>(["wifi"]);
  return (
    <BorderedList
      style={{ width: 170, height: 220 }}
      footerLabel="Edit services"
      footer={
        <>
          <GradientButton
            glyph="add"
            aria-label="Add a service"
            onClick={() => {
              const id = `vpn-${next.current++}`;
              setServices([...services, { id, name: `VPN ${next.current - 1}`, connected: false }]);
              setSelected([id]);
            }}
          />
          <GradientButton
            glyph="remove"
            aria-label="Remove the selected service"
            disabled={selected.length === 0}
            onClick={() => {
              setServices(services.filter((service) => !selected.includes(service.id)));
              setSelected([]);
            }}
          />
        </>
      }
    >
      <BorderedListRows
        aria-label="Network services"
        rowHeight={42}
        value={selected}
        onValueChange={setSelected}
      >
        {services.map((service) => (
          <BorderedListRow
            key={service.id}
            value={service.id}
            title={service.name}
            subtitle={service.connected ? "Connected" : "Not Connected"}
            leading={<StatusDot status={service.connected ? "available" : "unavailable"} />}
          />
        ))}
      </BorderedListRows>
    </BorderedList>
  );
}
