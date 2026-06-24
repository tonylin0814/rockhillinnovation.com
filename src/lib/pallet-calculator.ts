export type CartonInput = {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  weightKg: number;
  qtyPerCarton: number;
};

export type PalletInput = {
  lengthCm: number;
  widthCm: number;
  maxHeightCm: number;
  maxWeightKg: number;
};

export type PalletCalculation = {
  orientation: string;
  cartonsPerLayer: number;
  layers: number;
  cartonsPerPallet: number;
  itemsPerPallet: number;
  palletGrossWeightKg: number;
  palletHeightCm: number;
  footprintUsedPct: number;
};

export const CONTAINER_PRESETS = {
  "20GP": { label: "20GP", pallets: 10 },
  "40GP": { label: "40GP", pallets: 20 },
  "40HQ": { label: "40HQ", pallets: 22 },
} as const;

type OrientationResult = PalletCalculation & {
  boxLength: number;
  boxWidth: number;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function evaluateOrientation(
  label: string,
  carton: CartonInput,
  pallet: PalletInput,
  boxLength: number,
  boxWidth: number
): OrientationResult {
  const acrossLength = Math.floor(pallet.lengthCm / boxLength);
  const acrossWidth = Math.floor(pallet.widthCm / boxWidth);
  const cartonsPerLayer = acrossLength * acrossWidth;
  const layersByHeight = Math.floor(pallet.maxHeightCm / carton.heightCm);
  const layersByWeight =
    cartonsPerLayer > 0 && carton.weightKg > 0
      ? Math.floor(pallet.maxWeightKg / (cartonsPerLayer * carton.weightKg))
      : layersByHeight;
  const layers = Math.max(0, Math.min(layersByHeight, layersByWeight));
  const cartonsPerPallet = cartonsPerLayer * layers;
  const footprintUsedPct =
    pallet.lengthCm > 0 && pallet.widthCm > 0
      ? ((cartonsPerLayer * boxLength * boxWidth) / (pallet.lengthCm * pallet.widthCm)) * 100
      : 0;

  return {
    boxLength,
    boxWidth,
    cartonsPerLayer,
    cartonsPerPallet,
    footprintUsedPct: round2(footprintUsedPct),
    itemsPerPallet: cartonsPerPallet * carton.qtyPerCarton,
    layers,
    orientation: label,
    palletGrossWeightKg: round2(cartonsPerPallet * carton.weightKg),
    palletHeightCm: round2(layers * carton.heightCm),
  };
}

export function calculatePallet(carton: CartonInput, pallet: PalletInput): PalletCalculation {
  const orientations = [
    evaluateOrientation("L x W base", carton, pallet, carton.lengthCm, carton.widthCm),
    evaluateOrientation("W x L base", carton, pallet, carton.widthCm, carton.lengthCm),
    evaluateOrientation("Sideways", carton, pallet, carton.lengthCm, carton.heightCm),
  ];

  return orientations.reduce((best, candidate) => {
    if (candidate.itemsPerPallet > best.itemsPerPallet) {
      return candidate;
    }

    if (candidate.itemsPerPallet === best.itemsPerPallet && candidate.footprintUsedPct > best.footprintUsedPct) {
      return candidate;
    }

    return best;
  });
}

export function buildPalletTopViewSvg(
  carton: CartonInput,
  pallet: PalletInput,
  calculation: PalletCalculation
) {
  const orientation = calculation.orientation === "W x L base"
    ? { length: carton.widthCm, width: carton.lengthCm }
    : calculation.orientation === "Sideways"
      ? { length: carton.lengthCm, width: carton.heightCm }
      : { length: carton.lengthCm, width: carton.widthCm };
  const cartonsX = Math.floor(pallet.lengthCm / orientation.length);
  const cartonsY = Math.floor(pallet.widthCm / orientation.width);
  const scale = Math.min(620 / pallet.lengthCm, 360 / pallet.widthCm);
  const palletW = pallet.lengthCm * scale;
  const palletH = pallet.widthCm * scale;
  const cartonW = orientation.length * scale;
  const cartonH = orientation.width * scale;
  const cells: string[] = [];

  for (let y = 0; y < cartonsY; y += 1) {
    for (let x = 0; x < cartonsX; x += 1) {
      cells.push(
        `<rect x="${12 + x * cartonW}" y="${12 + y * cartonH}" width="${Math.max(
          1,
          cartonW - 2
        )}" height="${Math.max(1, cartonH - 2)}" rx="3" fill="#dbeafe" stroke="#2563eb" stroke-width="1" />`
      );
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${palletW + 24}" height="${palletH + 54}" viewBox="0 0 ${
    palletW + 24
  } ${palletH + 54}">
  <rect x="12" y="12" width="${palletW}" height="${palletH}" rx="6" fill="#f8fafc" stroke="#0d1b34" stroke-width="2" />
  ${cells.join("")}
  <text x="12" y="${palletH + 38}" fill="#0d1b34" font-family="Arial" font-size="13">
    Top view: ${calculation.cartonsPerLayer} cartons/layer (${calculation.orientation})
  </text>
</svg>`;
}

export function buildPalletSideViewSvg(carton: CartonInput, pallet: PalletInput, calculation: PalletCalculation) {
  const width = 620;
  const height = 300;
  const palletBaseY = 260;
  const palletBaseH = 14;
  const availableHeight = 220;
  const layerHeight = calculation.layers > 0 ? Math.max(8, availableHeight / calculation.layers) : 0;
  const layers: string[] = [];

  for (let layer = 0; layer < calculation.layers; layer += 1) {
    layers.push(
      `<rect x="80" y="${palletBaseY - (layer + 1) * layerHeight}" width="460" height="${Math.max(
        6,
        layerHeight - 2
      )}" rx="3" fill="#e0f2fe" stroke="#0284c7" stroke-width="1" />`
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <line x1="48" y1="${palletBaseY - availableHeight}" x2="48" y2="${palletBaseY}" stroke="#94a3b8" stroke-width="2" />
  <text x="14" y="${palletBaseY - availableHeight - 8}" fill="#64748b" font-family="Arial" font-size="12">Max ${pallet.maxHeightCm} cm</text>
  ${layers.join("")}
  <rect x="60" y="${palletBaseY}" width="500" height="${palletBaseH}" rx="4" fill="#0d1b34" />
  <text x="80" y="288" fill="#0d1b34" font-family="Arial" font-size="13">
    Side view: ${calculation.layers} layers, ${calculation.palletHeightCm} cm cartons height, ${calculation.palletGrossWeightKg} kg
  </text>
</svg>`;
}
