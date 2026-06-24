import { calculatePallet } from "@/lib/pallet-calculator";
import type { ContainerType } from "@/types";

export type PackingOrderLine = {
  product_id: string;
  product_code: string;
  product_name: string;
  quantity: number;
  qty_per_carton: number;
  carton_weight_kg: number;
  carton_length_cm: number;
  carton_width_cm: number;
  carton_height_cm: number;
};

export type GeneratedCase = {
  product_id: string;
  product_code: string;
  product_name: string;
  case_number: number;
  case_label: string;
  qty_in_case: number;
  weight_kg: number;
  max_cases_per_pallet: number;
};

export type GeneratedPallet = {
  pallet_number: number;
  pallet_label: string;
  is_mixed: boolean;
  cases: GeneratedCase[];
  total_cases: number;
  total_weight_kg: number;
};

export type GeneratedPlan = {
  pallets: GeneratedPallet[];
  total_pallets: number;
  total_cases: number;
  total_weight_kg: number;
  cases_per_pallet: number;
  pallets_per_container: number;
  container_capacity_cases: number;
  warnings: string[];
};

const CONTAINER_DIMS: Record<ContainerType, { length: number; width: number; height: number }> = {
  "20ft": { height: 239, length: 589.8, width: 235.2 },
  "40ft": { height: 239, length: 1203.2, width: 235.2 },
  "40hq": { height: 269.8, length: 1203.2, width: 235.2 },
};

function round3(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

export function generatePackingPlan(
  orderLines: PackingOrderLine[],
  palletConfig: { length_cm: number; width_cm: number; height_cm: number; max_weight_kg: number },
  containerType: ContainerType,
  forkliftClearanceCm: number
): GeneratedPlan {
  const warnings: string[] = [];
  const container = CONTAINER_DIMS[containerType];
  const palletsNormal =
    Math.floor(container.length / palletConfig.length_cm) * Math.floor(container.width / palletConfig.width_cm);
  const palletsRotated =
    Math.floor(container.length / palletConfig.width_cm) * Math.floor(container.width / palletConfig.length_cm);
  const palletsPerContainer = Math.max(palletsNormal, palletsRotated);
  const availableHeightCm = container.height - palletConfig.height_cm - forkliftClearanceCm;
  const validLines = orderLines.filter((line) => {
    const ok =
      line.quantity > 0 &&
      line.qty_per_carton > 0 &&
      line.carton_weight_kg > 0 &&
      line.carton_length_cm > 0 &&
      line.carton_width_cm > 0 &&
      line.carton_height_cm > 0;
    if (!ok) warnings.push(`${line.product_code}: missing carton data - skipped`);
    return ok;
  });

  type ProductPlan = PackingOrderLine & {
    cases: GeneratedCase[];
    cases_per_pallet: number;
    total_cases: number;
  };

  const productPlans: ProductPlan[] = validLines
    .map((line) => {
      const calc = calculatePallet(
        {
          heightCm: line.carton_height_cm,
          lengthCm: line.carton_length_cm,
          qtyPerCarton: line.qty_per_carton,
          weightKg: line.carton_weight_kg,
          widthCm: line.carton_width_cm,
        },
        {
          lengthCm: palletConfig.length_cm,
          maxHeightCm: availableHeightCm,
          maxWeightKg: palletConfig.max_weight_kg,
          widthCm: palletConfig.width_cm,
        }
      );
      const casesPerPallet = Math.max(1, calc.cartonsPerPallet);
      const totalCases = Math.ceil(line.quantity / line.qty_per_carton);
      const cases = Array.from({ length: totalCases }, (_, index) => {
        const caseNumber = index + 1;
        const remainder = line.quantity % line.qty_per_carton;
        const qtyInCase = caseNumber === totalCases && remainder > 0 ? remainder : line.qty_per_carton;
        return {
          case_label: `${line.product_code}-${String(caseNumber).padStart(3, "0")}`,
          case_number: caseNumber,
          product_code: line.product_code,
          product_id: line.product_id,
          product_name: line.product_name,
          qty_in_case: qtyInCase,
          weight_kg: round3(line.carton_weight_kg * (qtyInCase / line.qty_per_carton)),
          max_cases_per_pallet: casesPerPallet,
        };
      });
      return { ...line, cases, cases_per_pallet: casesPerPallet, total_cases: totalCases };
    })
    .sort((a, b) => b.carton_weight_kg - a.carton_weight_kg);

  const pallets: GeneratedPallet[] = [];
  const remainders: GeneratedCase[] = [];
  let palletCounter = 0;

  function newPallet(isMixed: boolean): GeneratedPallet {
    palletCounter += 1;
    return {
      cases: [],
      is_mixed: isMixed,
      pallet_label: `P-${String(palletCounter).padStart(3, "0")}`,
      pallet_number: palletCounter,
      total_cases: 0,
      total_weight_kg: 0,
    };
  }

  for (const product of productPlans) {
    const remaining = [...product.cases];
    while (remaining.length >= product.cases_per_pallet) {
      const pallet = newPallet(false);
      pallet.cases = remaining.splice(0, product.cases_per_pallet);
      pallet.total_cases = pallet.cases.length;
      pallet.total_weight_kg = round3(pallet.cases.reduce((sum, item) => sum + item.weight_kg, 0));
      pallets.push(pallet);
    }
    remainders.push(...remaining);
  }

  let mixed = newPallet(true);
  let mixedCaseLimit = Number.POSITIVE_INFINITY;
  for (const item of remainders.sort((a, b) => b.weight_kg - a.weight_kg)) {
    const nextCaseLimit = Math.min(mixedCaseLimit, item.max_cases_per_pallet);
    if (
      mixed.cases.length &&
      (mixed.total_weight_kg + item.weight_kg > palletConfig.max_weight_kg ||
        mixed.total_cases + 1 > nextCaseLimit)
    ) {
      pallets.push(mixed);
      mixed = newPallet(true);
      mixedCaseLimit = Number.POSITIVE_INFINITY;
    }
    mixedCaseLimit = Math.min(mixedCaseLimit, item.max_cases_per_pallet);
    mixed.cases.push(item);
    mixed.total_cases += 1;
    mixed.total_weight_kg = round3(mixed.total_weight_kg + item.weight_kg);
  }
  if (mixed.cases.length) pallets.push(mixed);

  const totalCases = pallets.reduce((sum, pallet) => sum + pallet.total_cases, 0);
  const totalWeight = round3(pallets.reduce((sum, pallet) => sum + pallet.total_weight_kg, 0));
  const casesPerPallet = productPlans[0]?.cases_per_pallet ?? 0;

  return {
    cases_per_pallet: casesPerPallet,
    container_capacity_cases: palletsPerContainer * casesPerPallet,
    pallets,
    pallets_per_container: palletsPerContainer,
    total_cases: totalCases,
    total_pallets: pallets.length,
    total_weight_kg: totalWeight,
    warnings,
  };
}
