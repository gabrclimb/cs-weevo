import { describe, expectTypeOf, it } from 'vitest'
import type { EventoCategoria, EventoTipo, ParticipanteStatus, TipoTurma, WeevoStart } from './dominio'
import type { Database, EventoRow, ParticipanteRow, TurmaRow } from './tipos'

type T = Database['public']['Tables']

// Asserções de tipo: quem verifica é o `pnpm typecheck`; em runtime não fazem nada.
describe('tipos derivados do banco', () => {
  it('estreitam as colunas com CHECK no Row', () => {
    expectTypeOf<ParticipanteRow['status']>().toEqualTypeOf<ParticipanteStatus>()
    expectTypeOf<ParticipanteRow['weevo_start']>().toEqualTypeOf<WeevoStart>()
    expectTypeOf<TurmaRow['tipo']>().toEqualTypeOf<TipoTurma>()
    expectTypeOf<EventoRow['categoria']>().toEqualTypeOf<EventoCategoria | null>()
  })

  it('mantêm o resto do Row igual ao gerado', () => {
    expectTypeOf<ParticipanteRow['nome']>().toEqualTypeOf<string>()
    expectTypeOf<ParticipanteRow['turma_id']>().toEqualTypeOf<string | null>()
  })

  it('mantêm obrigatoriedade no Insert e estreitam o valor', () => {
    expectTypeOf<T['weevo_eventos']['Insert']['tipo']>().toEqualTypeOf<EventoTipo>()
    expectTypeOf<T['weevo_participantes']['Insert']>().toHaveProperty('status').toEqualTypeOf<ParticipanteStatus | undefined>()
    expectTypeOf<{ participante_id: string; tipo: 'nota' }>().toExtend<T['weevo_eventos']['Insert']>()
    expectTypeOf<{ participante_id: string }>().not.toExtend<T['weevo_eventos']['Insert']>()
  })
})
