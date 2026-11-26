import { Sidebar, SidebarItem, type SidebarProps } from "macalicious/sidebar";

const caption = {
  margin: "0 0 6px",
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

/** A stand-in glyph that fills the icon box of each size. */
const folder = (
  <svg
    viewBox="0 0 18 18"
    width="100%"
    height="100%"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    aria-hidden="true"
  >
    <path d="M2 4h5l2 2h7v9H2z" />
  </svg>
);

function Folders({ size }: Pick<SidebarProps, "size">) {
  return (
    <div>
      <p style={caption}>{size}</p>
      <Sidebar
        aria-label={`Folders, ${size}`}
        size={size}
        material="opaque"
        defaultValue="documents"
        style={{ width: 150 }}
      >
        <SidebarItem value="desktop" label="Desktop" icon={folder} />
        <SidebarItem value="documents" label="Documents" icon={folder} />
        <SidebarItem value="downloads" label="Downloads" icon={folder} />
      </Sidebar>
    </div>
  );
}

/** The three settings of “Sidebar icon size” in General preferences. */
export default function Sizes() {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "start" }}>
      <Folders size="small" />
      <Folders size="medium" />
      <Folders size="large" />
    </div>
  );
}
