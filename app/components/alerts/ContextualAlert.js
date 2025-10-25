import { useAlert } from "@/app/context/AlertContext";
import { ALERT_TYPE } from "@/app/constants";
import OverpaymentAlert from "./OverPaymentAlert";
import OverInvoicedAlert from "./OverInvoicedAlert";

export default function ContextualAlert() {
  const { alert, hideAlert } = useAlert();
  if (!alert.visible) return null;
  const data = alert.data;
  if (alert.type === ALERT_TYPE.OVERPAYMENT_ALERT)
    return <OverpaymentAlert estimation={data.estimation} userRole={data.userRole} fetchProjectData={data.fetchProjectData}  />;
  
  if (alert.type === ALERT_TYPE.OVER_INVOICED_ALERT)
    return <OverInvoicedAlert data={data} onClose={hideAlert} />;

  return null;
}