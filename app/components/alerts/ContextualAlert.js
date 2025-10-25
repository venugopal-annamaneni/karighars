import { useAlert } from "@/app/context/AlertContext";
import { ALERT_TYPE } from "@/lib/constants";
import OverpaymentAlert from "./OverPaymentAlert";

export default function ContextualAlert() {
  const { alert, hideAlert } = useAlert();
  if (!alert.visible) return null;
  const data = alert.data;
  if (alert.type === ALERT_TYPE.OVERPAYMENT_ALERT)
    return <OverpaymentAlert estimation={data.estimation} userRole={data.userRole} fetchProjectData={data.fetchProjectData}  />;

  return null;
}