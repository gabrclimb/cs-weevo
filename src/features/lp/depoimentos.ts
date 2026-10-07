import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { mensagemErro } from '@/lib/utils'

const BUCKET = 'depoimentos'
export const LIMITE_VIDEO_MB = 50

// O texto fica aqui; só o vídeo é enviado pelo sistema (tabela weevo_depoimentos + bucket "depoimentos").
export const DEPOIMENTOS = [
  {
    chave: 'superintendente',
    cargo: 'Diretor Superintendente',
    local: 'Casa de Saúde São Lucas',
    destaque: true,
    frase:
      'Estamos aqui com toda a equipe de gestão, conhecendo as ferramentas de IA para desenvolver melhorias em todos os processos do hospital. Estamos aplicando os conceitos na prática, imediatamente, com o objetivo de sair ao final do dia com várias soluções prontas para utilização já desde segunda-feira.',
  },
  {
    chave: 'assistencial',
    cargo: 'Gerente Assistencial',
    local: 'Casa de Saúde São Lucas',
    frase:
      'Comecei pelo workshop e me empolguei bastante. A Imersão foi fantástica, porque vem mostrando o quanto melhora o nosso trabalho, o quanto agiliza meu dia a dia.',
  },
  {
    chave: 'ciclo_receita',
    cargo: 'Gerente do Ciclo da Receita',
    local: 'Casa de Saúde São Lucas',
    frase: 'Isso tudo se transforma em resultado: a gente ganha tempo para tomar a decisão. Os dados vêm com maior precisão, com maior velocidade.',
  },
  {
    chave: 'oncoclinica',
    cargo: 'Administrador',
    local: 'Oncoclínica São Marcos',
    destaque: true,
    frase:
      'Aprendemos a construir agentes e automações que vão reduzir essa carga de trabalho repetitivo. Eu comparo trabalhar agora a um polvo, com vários tentáculos que eu posso colocar para rodar em várias tarefas, otimizando o meu tempo, a minha energia e a da minha equipe.',
  },
] as const

export type ChaveDepoimento = (typeof DEPOIMENTOS)[number]['chave']

const CHAVE_QUERY = ['depoimentos'] as const

export function urlVideo(path: string | null | undefined) {
  return path ? supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : null
}

/** Mapa chave → caminho do vídeo no bucket (null quando ainda não enviado). */
export function useDepoimentosVideos() {
  return useQuery({
    queryKey: CHAVE_QUERY,
    queryFn: async () => {
      const { data, error } = await supabase.from('weevo_depoimentos').select('chave, video_path')
      if (error) throw error
      return Object.fromEntries(data.map((d) => [d.chave, d.video_path])) as Record<string, string | null>
    },
  })
}

export function useEnviarVideo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ chave, arquivo, anterior }: { chave: ChaveDepoimento; arquivo: File; anterior: string | null }) => {
      if (!arquivo.type.startsWith('video/')) throw new ErroUsuario('Escolha um arquivo de vídeo (MP4, MOV ou WebM).')
      if (arquivo.size > LIMITE_VIDEO_MB * 1024 * 1024) {
        throw new ErroUsuario(`O vídeo passa de ${LIMITE_VIDEO_MB} MB. Comprima o arquivo e tente de novo.`)
      }
      const extensao = arquivo.name.split('.').pop()?.toLowerCase() || 'mp4'
      // Nome novo a cada envio evita cache do navegador/CDN servindo o vídeo antigo.
      const path = `${chave}-${Date.now()}.${extensao}`
      const up = await supabase.storage.from(BUCKET).upload(path, arquivo, { contentType: arquivo.type, cacheControl: '31536000' })
      if (up.error) throw up.error
      const { error } = await supabase.from('weevo_depoimentos').update({ video_path: path }).eq('chave', chave)
      if (error) {
        await supabase.storage.from(BUCKET).remove([path])
        throw error
      }
      if (anterior) await supabase.storage.from(BUCKET).remove([anterior])
    },
    onSuccess: () => {
      toast.success('Vídeo enviado. Já aparece na página inicial.')
      qc.invalidateQueries({ queryKey: CHAVE_QUERY })
    },
    onError: (e) => toast.error(e instanceof ErroUsuario ? e.message : mensagemErro(e as { code?: string; message?: string })),
  })
}

export function useRemoverVideo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ chave, path }: { chave: ChaveDepoimento; path: string }) => {
      const { error } = await supabase.from('weevo_depoimentos').update({ video_path: null }).eq('chave', chave)
      if (error) throw error
      await supabase.storage.from(BUCKET).remove([path])
    },
    onSuccess: () => {
      toast.success('Vídeo removido da página inicial.')
      qc.invalidateQueries({ queryKey: CHAVE_QUERY })
    },
    onError: (e) => toast.error(mensagemErro(e as { code?: string; message?: string })),
  })
}

class ErroUsuario extends Error {}
