import { OrdersBoard } from "./_components/OrdersBoard";
import { ProviderPanel } from "./_components/ProviderPanel";
import { RidersPanel } from "./_components/RidersPanel";
import { SimulationPanel } from "./_components/SimulationPanel";

export default function OpsPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <OrdersBoard />
      <aside className="divide-y divide-line border-line lg:border-l lg:pl-6">
        <ProviderPanel />
        <RidersPanel />
        <SimulationPanel />
      </aside>
    </div>
  );
}
