export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      message_template_categories: {
        Row: {
          created_at: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          category_id: string | null
          conteudo: string
          created_at: string
          id: string
          ordem: number
          titulo: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          conteudo: string
          created_at?: string
          id?: string
          ordem?: number
          titulo: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          conteudo?: string
          created_at?: string
          id?: string
          ordem?: number
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "message_template_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      weevo_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      weevo_depoimentos: {
        Row: {
          chave: string
          updated_at: string
          video_path: string | null
        }
        Insert: {
          chave: string
          updated_at?: string
          video_path?: string | null
        }
        Update: {
          chave?: string
          updated_at?: string
          video_path?: string | null
        }
        Relationships: []
      }
      weevo_eventos: {
        Row: {
          categoria: string | null
          created_at: string
          id: string
          nota: string | null
          ocorrido_em: string
          origem: string
          participante_id: string
          plantao_id: string | null
          tarefa_id: string | null
          tipo: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          id?: string
          nota?: string | null
          ocorrido_em?: string
          origem?: string
          participante_id: string
          plantao_id?: string | null
          tarefa_id?: string | null
          tipo: string
        }
        Update: {
          categoria?: string | null
          created_at?: string
          id?: string
          nota?: string | null
          ocorrido_em?: string
          origem?: string
          participante_id?: string
          plantao_id?: string | null
          tarefa_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "weevo_eventos_participante_id_fkey"
            columns: ["participante_id"]
            isOneToOne: false
            referencedRelation: "weevo_participantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weevo_eventos_plantao_id_fkey"
            columns: ["plantao_id"]
            isOneToOne: false
            referencedRelation: "weevo_plantoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weevo_eventos_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "weevo_tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      weevo_participantes: {
        Row: {
          apelido: string | null
          cadastro_plataforma: string | null
          created_at: string
          dia_escolhido: string | null
          dificuldades: string | null
          empresa: string | null
          id: string
          implementou: boolean
          nome: string
          nps: string | null
          observacoes: string | null
          responsavel: string | null
          sistema: string | null
          status: string
          suporte_extra: string | null
          telefone: string | null
          turma_id: string | null
          ultima_resposta_em: string | null
          ultimo_contato_em: string | null
          updated_at: string
          weevo_start: string
        }
        Insert: {
          apelido?: string | null
          cadastro_plataforma?: string | null
          created_at?: string
          dia_escolhido?: string | null
          dificuldades?: string | null
          empresa?: string | null
          id?: string
          implementou?: boolean
          nome: string
          nps?: string | null
          observacoes?: string | null
          responsavel?: string | null
          sistema?: string | null
          status?: string
          suporte_extra?: string | null
          telefone?: string | null
          turma_id?: string | null
          ultima_resposta_em?: string | null
          ultimo_contato_em?: string | null
          updated_at?: string
          weevo_start?: string
        }
        Update: {
          apelido?: string | null
          cadastro_plataforma?: string | null
          created_at?: string
          dia_escolhido?: string | null
          dificuldades?: string | null
          empresa?: string | null
          id?: string
          implementou?: boolean
          nome?: string
          nps?: string | null
          observacoes?: string | null
          responsavel?: string | null
          sistema?: string | null
          status?: string
          suporte_extra?: string | null
          telefone?: string | null
          turma_id?: string | null
          ultima_resposta_em?: string | null
          ultimo_contato_em?: string | null
          updated_at?: string
          weevo_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weevo_participantes_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "weevo_turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      weevo_plantoes: {
        Row: {
          created_at: string
          data: string | null
          formato: string
          horario: string | null
          id: string
          link: string | null
          numero: number
          observacoes: string | null
          realizado: boolean
          turma_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: string | null
          formato?: string
          horario?: string | null
          id?: string
          link?: string | null
          numero: number
          observacoes?: string | null
          realizado?: boolean
          turma_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: string | null
          formato?: string
          horario?: string | null
          id?: string
          link?: string | null
          numero?: number
          observacoes?: string | null
          realizado?: boolean
          turma_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "weevo_plantoes_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "weevo_turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      weevo_tarefas: {
        Row: {
          canal: string | null
          created_at: string
          data: string | null
          data_prevista: string | null
          enviado_em: string | null
          horario: string | null
          id: string
          import_key: string | null
          mensagem: string | null
          objetivo: string | null
          ordem: number
          para_quem: string | null
          parent_id: string | null
          participante_id: string | null
          plantao_id: string | null
          respondido_em: string | null
          resultado: string | null
          status: string
          tipo: string
          titulo: string
          turma_id: string | null
          updated_at: string
        }
        Insert: {
          canal?: string | null
          created_at?: string
          data?: string | null
          data_prevista?: string | null
          enviado_em?: string | null
          horario?: string | null
          id?: string
          import_key?: string | null
          mensagem?: string | null
          objetivo?: string | null
          ordem?: number
          para_quem?: string | null
          parent_id?: string | null
          participante_id?: string | null
          plantao_id?: string | null
          respondido_em?: string | null
          resultado?: string | null
          status?: string
          tipo?: string
          titulo: string
          turma_id?: string | null
          updated_at?: string
        }
        Update: {
          canal?: string | null
          created_at?: string
          data?: string | null
          data_prevista?: string | null
          enviado_em?: string | null
          horario?: string | null
          id?: string
          import_key?: string | null
          mensagem?: string | null
          objetivo?: string | null
          ordem?: number
          para_quem?: string | null
          parent_id?: string | null
          participante_id?: string | null
          plantao_id?: string | null
          respondido_em?: string | null
          resultado?: string | null
          status?: string
          tipo?: string
          titulo?: string
          turma_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "weevo_tarefas_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "weevo_tarefas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weevo_tarefas_participante_id_fkey"
            columns: ["participante_id"]
            isOneToOne: false
            referencedRelation: "weevo_participantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weevo_tarefas_plantao_id_fkey"
            columns: ["plantao_id"]
            isOneToOne: false
            referencedRelation: "weevo_plantoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weevo_tarefas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "weevo_turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      weevo_turmas: {
        Row: {
          ativa: boolean
          created_at: string
          data_imersao: string | null
          id: string
          link_grupo: string | null
          nome: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          data_imersao?: string | null
          id?: string
          link_grupo?: string | null
          nome: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          created_at?: string
          data_imersao?: string | null
          id?: string
          link_grupo?: string | null
          nome?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
