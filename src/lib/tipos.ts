// Tipos do app derivados de database.types.ts (gerado por `pnpm db:types`, nunca editado à mão).
// O gerado traz colunas com CHECK como `string`; aqui elas ganham as uniões de dominio.ts,
// e o cliente do Supabase usa este `Database`, então as consultas já devolvem os tipos estreitos.

import type { Database as Gerado } from './database.types'
import type {
  EventoCategoria,
  EventoTipo,
  FormatoPlantao,
  OrigemEvento,
  ParticipanteStatus,
  StatusTarefa,
  TipoTarefa,
  TipoTurma,
  WeevoStart,
} from './dominio'

export type { Json } from './database.types'
export type * from './dominio'

type TabelasGeradas = Gerado['public']['Tables']

/** Troca o tipo das colunas listadas, preservando opcionalidade e `null` de cada uma. */
type Trocar<T, Colunas> = {
  [K in keyof T]: K extends keyof Colunas ? Colunas[K] | Extract<T[K], null> : T[K]
}

type Estreitar<Nome extends keyof TabelasGeradas, Colunas> = {
  Row: Trocar<TabelasGeradas[Nome]['Row'], Colunas>
  Insert: Trocar<TabelasGeradas[Nome]['Insert'], Colunas>
  Update: Trocar<TabelasGeradas[Nome]['Update'], Colunas>
  Relationships: TabelasGeradas[Nome]['Relationships']
}

type Tabelas = Omit<
  TabelasGeradas,
  'weevo_turmas' | 'weevo_plantoes' | 'weevo_participantes' | 'weevo_tarefas' | 'weevo_eventos'
> & {
  weevo_turmas: Estreitar<'weevo_turmas', { tipo: TipoTurma }>
  weevo_plantoes: Estreitar<'weevo_plantoes', { formato: FormatoPlantao }>
  weevo_participantes: Estreitar<'weevo_participantes', { status: ParticipanteStatus; weevo_start: WeevoStart }>
  weevo_tarefas: Estreitar<'weevo_tarefas', { tipo: TipoTarefa; status: StatusTarefa }>
  weevo_eventos: Estreitar<'weevo_eventos', { tipo: EventoTipo; categoria: EventoCategoria; origem: OrigemEvento }>
}

export type Database = Omit<Gerado, 'public'> & {
  public: Omit<Gerado['public'], 'Tables'> & { Tables: Tabelas }
}

type Row<Nome extends keyof Tabelas> = Tabelas[Nome]['Row']

export type TurmaRow = Row<'weevo_turmas'>
export type PlantaoRow = Row<'weevo_plantoes'>
export type ParticipanteRow = Row<'weevo_participantes'>
export type TarefaRow = Row<'weevo_tarefas'>
export type EventoRow = Row<'weevo_eventos'>
export type DepoimentoRow = Row<'weevo_depoimentos'>
export type TemplateCategoriaRow = Row<'message_template_categories'>
export type TemplateRow = Row<'message_templates'>
