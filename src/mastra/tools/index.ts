// Export all tool collections for easy access
// export { customerTools } from "./sanden/customer-tools"; // REMOVED - prevents orchestrator from calling customer tools directly
export { validateSession, getSystemInfo, getHelp } from "./sanden/common-tools";
export { searchProductsTool, createProductTool, updateProductTool, getProductsByCustomerIdTool } from "./sanden/product-tools";
export { createRepairTool, updateRepairTool, getRepairStatusTool } from "./sanden/repair-tools";
export { schedulingTools } from "./sanden/scheduling-tools";
export { zapierTools } from "./zapier-tools";
