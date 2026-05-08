import WarehouseInchargeDashboard from "./WarehouseInchargeDashboard";
import BackOfficeDashboard from "./BackOfficeDashboard";
import SalesDashboard from "./SalesDashboard";
import GemPortalDashboard from "./GemPortalDashboard";
import TeamLeaderDashboard from "./TeamLeaderDashboard";
import DefaultDashboard from "./DefaultDashboard";
import ServiceHeadDashboard from "./ServiceHeadDashboard";
import DirectorDashboard from "./DirectorDashboard";

export const DASHBOARD_MAP = {
  "WAREHOUSE INCHARGE": WarehouseInchargeDashboard,
  "BACK OFFICE": BackOfficeDashboard,
  "SALES": SalesDashboard,
  "GEM PORTAL": GemPortalDashboard,
  "TEAM LEADER": TeamLeaderDashboard,
  "SERVICE HEAD": ServiceHeadDashboard,
  "DIRECTOR": DirectorDashboard,
  DEFAULT: DefaultDashboard
};
