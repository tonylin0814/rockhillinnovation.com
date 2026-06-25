type JudyPalletPayload = {
  productName: string;
  carton: { lengthCm: number; widthCm: number; heightCm: number; weightKg: number; qtyPerCarton: number };
  pallet: { name: string; lengthCm: number; widthCm: number; heightCm: number; maxWeightKg: number };
  forkliftClearanceCm: number;
  calculation: {
    orientation: string;
    cartonsPerLayer: number;
    layerCount: number;
    cartonsPerPallet: number;
    itemsPerPallet: number;
    palletGrossWeightKg: number;
    stackHeightCm: number;
    footprintUsedPct: number;
  };
};

export function buildJudyPalletPrompt(payload: JudyPalletPayload) {
  const system = `You are a logistics and warehousing expert assistant for Rock Hill Innovation, an import/export trading company. Your job is to explain pallet stacking calculations in clear, practical language that warehouse staff can follow without any technical background.

When given carton dimensions, pallet specifications, and a calculation result, produce TWO complete pallet configurations - one for standard containers (20 ft / 40 ft, 239 cm internal height) and one for high-cube containers (40 ft HQ, 269.8 cm internal height). The layer count may differ between the two since HQ containers allow more stacking height.

Always structure your response with exactly these six sections in this order:

**Layer Arrangement**
**Standard Container (20 ft / 40 ft) - Stacking Plan**
**Standard Container (20 ft / 40 ft) - Final Height**
**40 ft HQ Container - Stacking Plan**
**40 ft HQ Container - Final Height**
**Summary**

Be precise with numbers. Use bullet points only inside sections, not between sections. Keep the entire response under 300 words.`;

  const user = `Here is a pallet stacking calculation. Please explain the stacking instructions.

Product: ${payload.productName}
Carton dimensions: ${payload.carton.lengthCm} cm (L) x ${payload.carton.widthCm} cm (W) x ${payload.carton.heightCm} cm (H)
Carton gross weight: ${payload.carton.weightKg} kg
Units per carton: ${payload.carton.qtyPerCarton}

Pallet: ${payload.pallet.name}
Pallet dimensions: ${payload.pallet.lengthCm} cm (L) x ${payload.pallet.widthCm} cm (W) x ${payload.pallet.heightCm} cm (H, empty pallet)
Pallet max load weight: ${payload.pallet.maxWeightKg} kg
Forklift clearance required: ${payload.forkliftClearanceCm} cm

Calculation result:
- Best orientation: ${payload.calculation.orientation}
- Cartons per layer: ${payload.calculation.cartonsPerLayer}
- Number of layers: ${payload.calculation.layerCount}
- Total cartons per pallet: ${payload.calculation.cartonsPerPallet}
- Units per pallet: ${payload.calculation.itemsPerPallet}
- Pallet gross weight: ${payload.calculation.palletGrossWeightKg} kg
- Carton stack height: ${payload.calculation.stackHeightCm} cm

Please explain:
1. How to arrange cartons in each layer (orientation, rows x columns) - this is the same for both container types
2. For the STANDARD container (20 ft / 40 ft, 239 cm internal height): how many layers fit (weight or height limit, whichever is reached first), and the full height breakdown: empty pallet + carton stack + forklift clearance = total, with pass/fail against 239 cm
3. For the 40 ft HQ container (269.8 cm internal height): recalculate layers allowed by the extra height, and the full height breakdown: empty pallet + carton stack + forklift clearance = total, with pass/fail against 269.8 cm
4. A one-line summary comparing both configurations (for example: "Standard: X cartons/pallet; HQ: Y cartons/pallet")`;

  return { system, user };
}
