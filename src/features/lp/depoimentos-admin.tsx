import { useRef } from 'react'
import { Trash2, Upload } from 'lucide-react'
import { Badge, Button } from '@/components/ui'
import { InfoDica } from '@/components/dica'
import { DEPOIMENTOS, LIMITE_VIDEO_MB, urlVideo, useDepoimentosVideos, useEnviarVideo, useRemoverVideo, type ChaveDepoimento } from './depoimentos'

export function DepoimentosLp() {
  const videos = useDepoimentosVideos()
  const enviar = useEnviarVideo()
  const remover = useRemoverVideo()

  return (
    <section className="space-y-3">
      <div>
        <h2 className="flex items-center gap-1.5 text-lg font-semibold">
          Vídeos da página inicial
          <InfoDica texto="Os vídeos de depoimento aparecem na página inicial do sistema, aberta a qualquer visitante. Enviar um novo vídeo substitui o anterior." />
        </h2>
        <p className="text-sm text-muted-foreground">
          Formato MP4, MOV ou WebM, até {LIMITE_VIDEO_MB} MB cada. Prefira vídeo vertical, comprimido.
        </p>
      </div>

      {videos.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">Não foi possível carregar os vídeos. Tente novamente.</div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {DEPOIMENTOS.map((d) => {
            const path = videos.data?.[d.chave] ?? null
            const src = urlVideo(path)
            const ocupado = (enviar.isPending && enviar.variables?.chave === d.chave) || (remover.isPending && remover.variables?.chave === d.chave)
            return (
              <li key={d.chave} className="flex flex-wrap items-center gap-4 p-4">
                {src ? (
                  <video src={src} controls preload="metadata" className="aspect-[9/16] h-28 rounded-md bg-black object-cover" />
                ) : (
                  <div className="flex aspect-[9/16] h-28 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">Sem vídeo</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{d.cargo}</p>
                  <p className="text-sm text-muted-foreground">{d.local}</p>
                  <div className="mt-1.5">
                    {path ? <Badge className="bg-emerald-100 text-emerald-800">Publicado</Badge> : <Badge className="bg-amber-100 text-amber-800">Aguardando vídeo</Badge>}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <SeletorVideo
                    rotulo={path ? 'Trocar vídeo' : 'Enviar vídeo'}
                    desabilitado={ocupado}
                    enviando={enviar.isPending && enviar.variables?.chave === d.chave}
                    onEscolher={(arquivo) => enviar.mutate({ chave: d.chave as ChaveDepoimento, arquivo, anterior: path })}
                  />
                  {path && (
                    <Button
                      variante="fantasma"
                      className="h-8 px-2 text-xs text-rose-600 hover:text-rose-600"
                      disabled={ocupado}
                      onClick={() => remover.mutate({ chave: d.chave as ChaveDepoimento, path })}
                    >
                      <Trash2 className="size-3.5" />
                      Remover
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function SeletorVideo({ rotulo, desabilitado, enviando, onEscolher }: { rotulo: string; desabilitado: boolean; enviando: boolean; onEscolher: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={(e) => {
          const arquivo = e.target.files?.[0]
          e.target.value = ''
          if (arquivo) onEscolher(arquivo)
        }}
      />
      <Button variante="secundario" className="h-8 px-2 text-xs" disabled={desabilitado} onClick={() => ref.current?.click()}>
        <Upload className="size-3.5" />
        {enviando ? 'Enviando…' : rotulo}
      </Button>
    </>
  )
}
