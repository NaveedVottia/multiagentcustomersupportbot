// Mastra Configuration for Local Playground
// This connects your local Mastra instance to Zapier MCP

export default {
  // MCP Server Configuration
  mcp: {
    servers: {
      // Zapier MCP Server
      zapier: {
        url: "https://mcp.zapier.com/api/mcp/s/ODdlMGE2NmQtYmNmOS00ZDI4LWExNGMtN2VkM2E5ZDAwNmI2OmY1MGVjOTQzLWZlYTEtNGUxNC05MWI0LWFjMjM5N2FlZjFjYg==/mcp",
        description: "Zapier MCP Server for Google Sheets, Calendar, and AI tools",
        tools: [
          "google_sheets_lookup_spreadsheet_rows_advanced",
          "google_sheets_get_many_spreadsheet_rows_advanced", 
          "google_sheets_create_spreadsheet_row",
          "google_sheets_update_spreadsheet_row",
          "google_calendar_quick_add_event",
          "ai_by_zapier_extract_content_from_url_beta"
        ]
      }
    }
  },

  // Agent Configuration
  agents: {
    "customer-identification": {
      tools: ["zapier"],
      description: "Customer identification agent with Zapier MCP integration"
    }
  },

  // Tool Configuration
  tools: {
    zapier: {
      type: "mcp",
      server: "zapier",
      description: "Access to Zapier MCP tools for external integrations"
    }
  }
};
