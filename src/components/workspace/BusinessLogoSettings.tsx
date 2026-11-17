import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandingService } from '@/lib/pharmacy-service';
export function BusinessLogoSettings({ pharmacyId, name }: { pharmacyId: string; name: string }) {
  const qc = useQueryClient(); const [busy, setBusy] = useState(false);
  const { data: logo } = useQuery({ queryKey: ['logo', pharmacyId], queryFn: () => BrandingService.getLogoUrl(pharmacyId), staleTime: 0 });
  return <section className="flex flex-wrap items-center gap-4 border-b border-border pb-5">
    {logo ? <img src={logo} alt={`${name} logo`} className="h-20 w-32 object-contain" /> : <div className="h-20 w-32 flex items-center justify-center bg-muted text-muted-foreground text-sm">No business logo</div>}
    <div className="space-y-2"><h3 className="font-bold">Business logo</h3><p className="text-sm text-muted-foreground">PNG, JPEG or WebP · Maximum 2 MB</p>
      <Button variant="outline" disabled={busy} asChild><label><Upload className="h-4 w-4" />{busy ? 'Uploading…' : logo ? 'Change logo' : 'Upload logo'}
        <input type="file" aria-label="Business logo" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={busy} onChange={async e => {
          const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; setBusy(true);
          try { await BrandingService.uploadLogo(pharmacyId, file); await Promise.all(['logo','logos'].map(key => qc.invalidateQueries({ queryKey: [key, pharmacyId] }))); toast.success('Business logo updated'); }
          catch (error) { toast.error(error instanceof Error ? error.message : 'Upload failed'); } finally { setBusy(false); }
        }} />
      </label></Button></div>
  </section>;
}
