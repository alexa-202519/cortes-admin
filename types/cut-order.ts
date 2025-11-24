export type BundleHistoryEntry = {
  action: string;
  location: string;
  date: string;
};

export type Bundle = {
  id: string;
  name: string;
  baseName: string;
  rawNumber: number | null;
  createdAt: string;
  currentLocation: string;
  sheets: number;
  workOrder: string;
  availability: string;
  status: string;
  sscc: string;
  luid: string;
  num_bobina?: string | null;
  history: BundleHistoryEntry[];
};

export type CutOrder = {
  id: string;
  code: string;
  label: string;
  date: string;
  status: "Activo" | "Inactivo";
  workflowStatus: string;
  locationFilter: string;
  completedBundles: number;
  pendingBundles: number;
  bundles: Bundle[];
};
