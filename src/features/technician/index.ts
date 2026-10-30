export {
  getTechnicianProfile,
  getTechnicianWorkOrderById,
  getTechnicianWorkOrders,
  updateTechnicianProfile,
  completeTechnicianWorkOrder,
  updateTechnicianWorkOrder,
} from "./queries";
export type {
  TechnicianProfile,
  TechnicianProfileUpdateInput,
  TechnicianRepairJob,
  TechnicianRepairJobStatus,
  TechnicianSkill,
  TechnicianWorkOrder,
  TechnicianWorkOrderDetailResult,
  TechnicianWorkOrderUpdateInput,
  TechnicianWorkOrdersResult,
} from "./types";
