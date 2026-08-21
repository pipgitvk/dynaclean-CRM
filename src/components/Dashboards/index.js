import WarehouseInchargeDashboard from "./WarehouseInchargeDashboard";
import BackOfficeDashboard from "./BackOfficeDashboard";
import SalesDashboard from "./SalesDashboard";
import GemPortalDashboard from "./GemPortalDashboard";
import TeamLeaderDashboard from "./TeamLeaderDashboard";
import DefaultDashboard from "./DefaultDashboard";
import ServiceHeadDashboard from "./ServiceHeadDashboard";
import DirectorDashboard from "./DirectorDashboard";
import AccountantDashboard from "./AccountantDashboard";
import WelderDashboard from "./WelderDashboard";
import HrDashboard from "./HrDashboard";

export const DASHBOARD_MAP = {
  "WAREHOUSE INCHARGE": WarehouseInchargeDashboard,
  "BACK OFFICE": BackOfficeDashboard,
  "SALES": SalesDashboard,
  "GEM PORTAL": GemPortalDashboard,
  "TEAM LEADER": TeamLeaderDashboard,
  "SERVICE HEAD": ServiceHeadDashboard,
  "HR": HrDashboard,
  "HR HEAD": HrDashboard,
  "HR EXECUTIVE": HrDashboard,
  "DIRECTOR": DirectorDashboard,
  "ACCOUNTANT": AccountantDashboard,
  "PRODUCTION ACCOUNTANT": AccountantDashboard,
  "WELDER": WelderDashboard,
  "WELDER HELPER": WelderDashboard,
  DEFAULT: DefaultDashboard
};
