import { lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClientOnly, createFileRoute } from '@tanstack/react-router';
import { CheckCircle2, Clock3, MapPin, Navigation, PackageCheck, Truck } from 'lucide-react';
import afyadawaLogo from '@/assets/brand/afyadawa_logo.png';
import { DeliveryService, DELIVERY_STAGES, STAGE_LABEL, workflowStatus, type DeliveryWorkflowStatus } from '@/lib/delivery-service';

const DeliveryMap = lazy(() => import('@/components/workspace/DeliveryMap'));
const TOKEN = import.meta.env['VITE_MAPBOX_PUBLIC_TOKEN'] || import.meta.env['VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN'] || '';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const date = (value: string | null) => value ? new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const terminal = (status: DeliveryWorkflowStatus) => ['delivered', 'cancelled', 'returned'].includes(status);

export const Route = createFileRoute('/track/$jobId')({
  head: () => ({ meta: [{ title: 'Track your delivery | Afyadawa' }, { name: 'robots', content: 'noindex,nofollow' }] }),
  component: PublicTrackingPage,
});

function PublicTrackingPage() {
  const { jobId } = Route.useParams();
  const validId = UUID.test(jobId);
  const tracking = useQuery({
    queryKey: ['public-delivery-tracking', jobId],
    queryFn: () => DeliveryService.publicTracking(jobId),
    enabled: validId,
    refetchInterval: (query) => query.state.data && terminal(workflowStatus(query.state.data.status)) ? false : 10000,
  });
  const job = tracking.data;
  const status = job ? workflowStatus(job.status) : null;

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
          <div className="min-w-0">
            <img src={afyadawaLogo} alt="Afyadawa" className="h-auto w-36 max-w-full object-contain object-left" />
            <div className="mt-1 text-xs text-slate-500">Delivery tracking</div>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
        {!validId ? <TrackingMessage title="Invalid tracking link" detail="Check the link and try again." /> :
          tracking.isPending ? <TrackingMessage title="Loading delivery" detail="Getting the latest tracking update…" /> :
          tracking.error ? <TrackingMessage title="Tracking is temporarily unavailable" detail={tracking.error.message} /> :
          !job ? <TrackingMessage title="Delivery not found" detail="This tracking link is invalid or the delivery is no longer available." /> : (
            <>
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div><p className="text-xs font-bold uppercase tracking-wider text-blue-700">Live delivery</p><h1 className="mt-1 text-2xl font-black text-slate-950">Track your order</h1></div>
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2"><div className="text-[10px] font-bold uppercase text-slate-500">Tracking number</div><div className="font-mono text-sm font-black text-slate-900">{job.tracking_number}</div></div>
              </div>
              <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
                <section className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className={`grid h-11 w-11 place-items-center rounded-xl ${['cancelled', 'failed'].includes(status!) ? 'bg-rose-100 text-rose-700' : status === 'delivered' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                        {status === 'delivered' ? <CheckCircle2 className="h-5 w-5" /> : <Truck className="h-5 w-5" />}
                      </div>
                      <div><div className="text-xs text-slate-500">Current status</div><div className="font-black text-slate-900">{status === 'in_process' && job.rider_seen_at ? 'Rider accepted' : STAGE_LABEL[status!]}</div></div>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-xs text-slate-500"><Clock3 className="h-3.5 w-3.5" />{terminal(status!) ? (status === 'delivered' ? `Delivered ${date(job.delivered_at)}` : `Delivery ${status}`) : 'Updates automatically every 10 seconds'}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="mb-4 text-xs font-black uppercase tracking-wider text-slate-500">Delivery progress</h2>
                    <ol className="space-y-4">
                      {DELIVERY_STAGES.map((stage, index) => {
                        const current = DELIVERY_STAGES.indexOf(status!);
                        const done = status !== 'cancelled' && status !== 'failed' && status !== 'returning' && status !== 'returned' && index <= current;
                        const active = stage === status;
                        return <li key={stage} className="flex gap-3">
                          <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-black ${done ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{done ? <CheckCircle2 className="h-4 w-4" /> : index + 1}</span>
                          <span className={`text-sm ${active ? 'font-black text-blue-700' : done ? 'font-semibold text-slate-800' : 'text-slate-400'}`}>{stage === 'in_process' && status === 'in_process' && job.rider_seen_at ? 'Rider accepted' : STAGE_LABEL[stage]}</span>
                        </li>;
                      })}
                    </ol>
                    {status === 'cancelled' && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">This delivery was cancelled.</p>}
                    {status === 'failed' && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">The rider reported a delivery issue. The business is arranging the next step.</p>}
                    {status === 'returning' && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">The order is being returned to the pharmacy.</p>}
                    {status === 'returned' && <p className="mt-4 rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">The order has been returned to the pharmacy.</p>}
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex gap-3">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <div><div className="text-[10px] font-bold uppercase text-slate-500">Pickup</div><p className="mt-0.5 text-sm font-semibold text-slate-800">{job.pickup_address || 'Pickup location'}</p></div>
                    </div>
                    <div className="my-3 ml-2 h-4 border-l border-dashed border-slate-300" />
                    <div className="flex gap-3">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                      <div><div className="text-[10px] font-bold uppercase text-slate-500">Drop-off</div><p className="mt-0.5 text-sm font-semibold text-slate-800">{job.dropoff_address}</p></div>
                    </div>
                    {job.rider_seen_at && <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500"><Navigation className="h-3.5 w-3.5 text-blue-600" />Rider location updated {date(job.rider_seen_at)}</div>}
                  </div>
                </section>
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                  {!TOKEN ? <div className="grid min-h-[420px] place-items-center rounded-xl bg-slate-100 px-6 text-center text-sm text-slate-600">The live map is temporarily unavailable. Delivery status will continue to update.</div> :
                    <ClientOnly fallback={<div className="min-h-[420px] rounded-xl bg-slate-100" />}>
                      <Suspense fallback={<div className="min-h-[420px] rounded-xl bg-slate-100" />}>
                        <DeliveryMap token={TOKEN} pickup={job.pickup_lat != null && job.pickup_lng != null ? { lat: job.pickup_lat, lng: job.pickup_lng } : null} dropoff={job.dropoff_lat != null && job.dropoff_lng != null ? { lat: job.dropoff_lat, lng: job.dropoff_lng } : null}
                          rider={job.rider_lat != null && job.rider_lng != null ? { lat: job.rider_lat, lng: job.rider_lng } : null}
                          pickupAddress={job.pickup_address} dropoffAddress={job.dropoff_address} routeTarget="dropoff" heightClassName="h-[65vh] min-h-[420px] max-h-[680px]" />
                      </Suspense>
                    </ClientOnly>}
                </section>
              </div>
            </>
          )}
      </div>
    </main>
  );
}

function TrackingMessage({ title, detail }: { title: string; detail: string }) {
  return <div className="mx-auto mt-16 max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
    <PackageCheck className="mx-auto h-10 w-10 text-blue-600" /><h1 className="mt-4 text-xl font-black text-slate-900">{title}</h1><p className="mt-2 text-sm text-slate-600">{detail}</p>
  </div>;
}
