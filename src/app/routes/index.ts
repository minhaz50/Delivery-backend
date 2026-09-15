import { Router } from "express";
import { AuthRoutes } from "../module/auth/auth.route";
import { UserRoutes } from "../module/user/user.route";
import { OrganizationRoutes } from "../module/organization/organization.route";
import { ZoneRoutes } from "../module/zone/zone.route";
import { HubRoutes } from "../module/hub/hub.route";
import { ShipmentRoutes } from "../module/shipment/shipment.route";
import { CourierRoutes } from "../module/courier/courier.route";
import { PricingRoutes } from "../module/pricing/pricing.route";
import { PaymentRoutes } from "../module/payment/payment.route";
import { NotificationRoutes } from "../module/notification/notification.route";
import { ManifestRoutes } from "../module/manifest/manifest.route";
import { AnalyticsRoutes } from "../module/analytics/analytics.route";
import { AdminRoutes } from "../module/admin/admin.route";

const router = Router();

const moduleRoutes: { path: string; route: Router }[] = [
  { path: "/auth", route: AuthRoutes },
  { path: "/users", route: UserRoutes },
  { path: "/organizations", route: OrganizationRoutes },
  { path: "/zones", route: ZoneRoutes },
  { path: "/hubs", route: HubRoutes },
  { path: "/shipments", route: ShipmentRoutes },
  { path: "/couriers", route: CourierRoutes },
  { path: "/pricing", route: PricingRoutes },
  { path: "/payments", route: PaymentRoutes },
  { path: "/notifications", route: NotificationRoutes },
  { path: "/manifests", route: ManifestRoutes },
  { path: "/analytics", route: AnalyticsRoutes },
  { path: "/admin", route: AdminRoutes },
];

moduleRoutes.forEach(({ path, route }) => router.use(path, route));

export default router;
