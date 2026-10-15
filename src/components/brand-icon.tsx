const brandIconUrl = new URL("../../extension/icons/brand.svg", import.meta.url).href;

export function BrandIcon({ size = 28 }: { size?: number }) {
  return <img src={brandIconUrl} width={size} height={size} alt="" aria-hidden="true" className="xylo-brand-icon" />;
}
