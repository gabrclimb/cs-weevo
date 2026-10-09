// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Button } from './ui'

afterEach(cleanup)

describe('Button', () => {
  it('renderiza o texto como botão', () => {
    render(<Button>Salvar</Button>)
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDefined()
  })
})
