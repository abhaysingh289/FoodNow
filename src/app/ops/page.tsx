import { OrdersBoard } from "./_components/OrdersBoard";
import { ProviderPanel } from "./_components/ProviderPanel";
import { RidersPanel } from "./_components/RidersPanel";
import { SimulationPanel } from "./_components/SimulationPanel";

export default function OpsPage() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_22rem] gap-6">
      <OrdersBoard />
      <aside className="space-y-4">
        <ProviderPanel />
        <RidersPanel />
        <SimulationPanel />
      </aside>
    </div>
  );
}
