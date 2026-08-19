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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          company_name: string | null
          created_at: string
          email_templates: Json | null
          favicon_url: string | null
          footer: string | null
          id: string
          logo_url: string | null
          owner_id: string
          primary_color: string | null
          secondary_color: string | null
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          email_templates?: Json | null
          favicon_url?: string | null
          footer?: string | null
          id?: string
          logo_url?: string | null
          owner_id: string
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          email_templates?: Json | null
          favicon_url?: string | null
          footer?: string | null
          id?: string
          logo_url?: string | null
          owner_id?: string
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          ip: string | null
          metadata: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          ip?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          ip?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      certificates: {
        Row: {
          code: string
          created_at: string
          document_id: string
          id: string
          pdf_path: string | null
          qr_path: string | null
          sha256: string
        }
        Insert: {
          code?: string
          created_at?: string
          document_id: string
          id?: string
          pdf_path?: string | null
          qr_path?: string | null
          sha256: string
        }
        Update: {
          code?: string
          created_at?: string
          document_id?: string
          id?: string
          pdf_path?: string | null
          qr_path?: string | null
          sha256?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: true
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          access_code: string | null
          address: string | null
          company: string | null
          created_at: string
          document: string | null
          email: string | null
          facial_embedding: string | null
          facial_model: string | null
          facial_registered_at: string | null
          facial_status: string | null
          id: string
          name: string
          notes: string | null
          owner_id: string
          phone: string | null
          role: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          access_code?: string | null
          address?: string | null
          company?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          facial_embedding?: string | null
          facial_model?: string | null
          facial_registered_at?: string | null
          facial_status?: string | null
          id?: string
          name: string
          notes?: string | null
          owner_id: string
          phone?: string | null
          role?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          access_code?: string | null
          address?: string | null
          company?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          facial_embedding?: string | null
          facial_model?: string | null
          facial_registered_at?: string | null
          facial_status?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
          role?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      document_attachments: {
        Row: {
          created_at: string
          document_id: string
          file_path: string
          id: string
          mime: string | null
          name: string
          size: number | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          document_id: string
          file_path: string
          id?: string
          mime?: string | null
          name: string
          size?: number | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          document_id?: string
          file_path?: string
          id?: string
          mime?: string | null
          name?: string
          size?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_attachments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          document_id: string
          edited_at: string | null
          id: string
          mentions: string[] | null
          parent_id: string | null
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          document_id: string
          edited_at?: string | null
          id?: string
          mentions?: string[] | null
          parent_id?: string | null
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          document_id?: string
          edited_at?: string | null
          id?: string
          mentions?: string[] | null
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_comments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "document_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      document_events: {
        Row: {
          actor: string | null
          browser: string | null
          created_at: string
          document_id: string
          id: string
          ip: string | null
          metadata: Json | null
          os: string | null
          signer_id: string | null
          type: Database["public"]["Enums"]["event_type"]
          user_agent: string | null
        }
        Insert: {
          actor?: string | null
          browser?: string | null
          created_at?: string
          document_id: string
          id?: string
          ip?: string | null
          metadata?: Json | null
          os?: string | null
          signer_id?: string | null
          type: Database["public"]["Enums"]["event_type"]
          user_agent?: string | null
        }
        Update: {
          actor?: string | null
          browser?: string | null
          created_at?: string
          document_id?: string
          id?: string
          ip?: string | null
          metadata?: Json | null
          os?: string | null
          signer_id?: string | null
          type?: Database["public"]["Enums"]["event_type"]
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_events_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_events_signer_id_fkey"
            columns: ["signer_id"]
            isOneToOne: false
            referencedRelation: "document_signers"
            referencedColumns: ["id"]
          },
        ]
      }
      document_fields: {
        Row: {
          created_at: string
          document_id: string
          filled_at: string | null
          h: number
          id: string
          label: string | null
          page: number
          required: boolean
          signer_id: string | null
          type: Database["public"]["Enums"]["field_type"]
          value: string | null
          w: number
          x: number
          y: number
        }
        Insert: {
          created_at?: string
          document_id: string
          filled_at?: string | null
          h?: number
          id?: string
          label?: string | null
          page?: number
          required?: boolean
          signer_id?: string | null
          type: Database["public"]["Enums"]["field_type"]
          value?: string | null
          w?: number
          x: number
          y: number
        }
        Update: {
          created_at?: string
          document_id?: string
          filled_at?: string | null
          h?: number
          id?: string
          label?: string | null
          page?: number
          required?: boolean
          signer_id?: string | null
          type?: Database["public"]["Enums"]["field_type"]
          value?: string | null
          w?: number
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_fields_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_fields_signer_id_fkey"
            columns: ["signer_id"]
            isOneToOne: false
            referencedRelation: "document_signers"
            referencedColumns: ["id"]
          },
        ]
      }
      document_history: {
        Row: {
          action: Database["public"]["Enums"]["history_action"]
          actor: string | null
          created_at: string
          document_id: string
          id: string
          ip: string | null
          metadata: Json | null
          user_agent: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["history_action"]
          actor?: string | null
          created_at?: string
          document_id: string
          id?: string
          ip?: string | null
          metadata?: Json | null
          user_agent?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["history_action"]
          actor?: string | null
          created_at?: string
          document_id?: string
          id?: string
          ip?: string | null
          metadata?: Json | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_history_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_signers: {
        Row: {
          access_token: string
          company: string | null
          cpf: string | null
          created_at: string
          decline_reason: string | null
          declined_at: string | null
          document_id: string
          email: string
          id: string
          ip: string | null
          name: string
          order_index: number
          role: string | null
          signature_path: string | null
          signed_at: string | null
          status: Database["public"]["Enums"]["signer_status"]
          updated_at: string
          user_agent: string | null
          viewed_at: string | null
        }
        Insert: {
          access_token?: string
          company?: string | null
          cpf?: string | null
          created_at?: string
          decline_reason?: string | null
          declined_at?: string | null
          document_id: string
          email: string
          id?: string
          ip?: string | null
          name: string
          order_index?: number
          role?: string | null
          signature_path?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["signer_status"]
          updated_at?: string
          user_agent?: string | null
          viewed_at?: string | null
        }
        Update: {
          access_token?: string
          company?: string | null
          cpf?: string | null
          created_at?: string
          decline_reason?: string | null
          declined_at?: string | null
          document_id?: string
          email?: string
          id?: string
          ip?: string | null
          name?: string
          order_index?: number
          role?: string | null
          signature_path?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["signer_status"]
          updated_at?: string
          user_agent?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_signers_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_tags: {
        Row: {
          document_id: string
          tag_id: string
        }
        Insert: {
          document_id: string
          tag_id: string
        }
        Update: {
          document_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          access_token: string
          cancelled_at: string | null
          certificate_id: string | null
          client_id: string | null
          created_at: string
          deadline: string | null
          decline_reason: string | null
          declined_at: string | null
          deleted_at: string | null
          file_path: string
          folder_id: string | null
          id: string
          is_archived: boolean
          is_favorite: boolean
          message: string | null
          name: string
          owner_id: string
          recipient_email: string | null
          recipient_name: string
          recipient_phone: string | null
          signature_path: string | null
          signed_at: string | null
          signed_file_path: string | null
          signer_ip: string | null
          signer_typed_name: string | null
          signer_user_agent: string | null
          signing_mode: Database["public"]["Enums"]["signing_mode"]
          status: Database["public"]["Enums"]["doc_status"]
          template_id: string | null
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          access_token?: string
          cancelled_at?: string | null
          certificate_id?: string | null
          client_id?: string | null
          created_at?: string
          deadline?: string | null
          decline_reason?: string | null
          declined_at?: string | null
          deleted_at?: string | null
          file_path: string
          folder_id?: string | null
          id?: string
          is_archived?: boolean
          is_favorite?: boolean
          message?: string | null
          name: string
          owner_id: string
          recipient_email?: string | null
          recipient_name: string
          recipient_phone?: string | null
          signature_path?: string | null
          signed_at?: string | null
          signed_file_path?: string | null
          signer_ip?: string | null
          signer_typed_name?: string | null
          signer_user_agent?: string | null
          signing_mode?: Database["public"]["Enums"]["signing_mode"]
          status?: Database["public"]["Enums"]["doc_status"]
          template_id?: string | null
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          access_token?: string
          cancelled_at?: string | null
          certificate_id?: string | null
          client_id?: string | null
          created_at?: string
          deadline?: string | null
          decline_reason?: string | null
          declined_at?: string | null
          deleted_at?: string | null
          file_path?: string
          folder_id?: string | null
          id?: string
          is_archived?: boolean
          is_favorite?: boolean
          message?: string | null
          name?: string
          owner_id?: string
          recipient_email?: string | null
          recipient_name?: string
          recipient_phone?: string | null
          signature_path?: string | null
          signed_at?: string | null
          signed_file_path?: string | null
          signer_ip?: string | null
          signer_typed_name?: string | null
          signer_user_agent?: string | null
          signing_mode?: Database["public"]["Enums"]["signing_mode"]
          status?: Database["public"]["Enums"]["doc_status"]
          template_id?: string | null
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_certificate_fk"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_log: {
        Row: {
          created_at: string
          document_id: string | null
          error: string | null
          id: string
          recipient: string
          signer_id: string | null
          status: string
          template: string
        }
        Insert: {
          created_at?: string
          document_id?: string | null
          error?: string | null
          id?: string
          recipient: string
          signer_id?: string | null
          status?: string
          template: string
        }
        Update: {
          created_at?: string
          document_id?: string | null
          error?: string | null
          id?: string
          recipient?: string
          signer_id?: string | null
          status?: string
          template?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_log_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_log_signer_id_fkey"
            columns: ["signer_id"]
            isOneToOne: false
            referencedRelation: "document_signers"
            referencedColumns: ["id"]
          },
        ]
      }
      facial_auth_sessions: {
        Row: {
          created_at: string
          document_id: string
          employee_id: string
          expires_at: string
          id: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          document_id: string
          employee_id: string
          expires_at: string
          id?: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          document_id?: string
          employee_id?: string
          expires_at?: string
          id?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facial_auth_sessions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facial_auth_sessions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      facial_validation_logs: {
        Row: {
          created_at: string | null
          document_id: string | null
          employee_id: string
          failure_reason: string | null
          id: string
          metadata: Json | null
          success: boolean
        }
        Insert: {
          created_at?: string | null
          document_id?: string | null
          employee_id: string
          failure_reason?: string | null
          id?: string
          metadata?: Json | null
          success: boolean
        }
        Update: {
          created_at?: string | null
          document_id?: string | null
          employee_id?: string
          failure_reason?: string | null
          id?: string
          metadata?: Json | null
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "facial_validation_logs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facial_validation_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          owner_id: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          document_id: string | null
          id: string
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          document_id?: string | null
          id?: string
          read_at?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          document_id?: string | null
          id?: string
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          whatsapp_template: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
          whatsapp_template?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          whatsapp_template?: string | null
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      templates: {
        Row: {
          category: string | null
          created_at: string
          fields_json: Json
          file_path: string
          id: string
          name: string
          owner_id: string
          signers_json: Json
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          fields_json?: Json
          file_path: string
          id?: string
          name: string
          owner_id: string
          signers_json?: Json
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          fields_json?: Json
          file_path?: string
          id?: string
          name?: string
          owner_id?: string
          signers_json?: Json
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_unique_access_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "manager" | "employee" | "viewer"
      doc_status:
        | "pendente"
        | "visualizado"
        | "assinado"
        | "recusado"
        | "expirado"
        | "cancelado"
      event_type:
        | "created"
        | "uploaded"
        | "sent"
        | "email_delivered"
        | "opened"
        | "viewed"
        | "signing_started"
        | "signed"
        | "declined"
        | "expired"
        | "cancelled"
        | "downloaded"
        | "certificate_generated"
        | "reminder_sent"
      field_type:
        | "signature"
        | "initial"
        | "name"
        | "cpf"
        | "company"
        | "role"
        | "date"
        | "text"
        | "checkbox"
      history_action:
        | "criado"
        | "enviado"
        | "visualizado"
        | "assinado"
        | "recusado"
        | "expirado"
        | "reenviado"
        | "cancelado"
      notification_type:
        | "document_sent"
        | "document_viewed"
        | "document_signed"
        | "document_declined"
        | "document_expired"
        | "document_cancelled"
        | "reminder"
        | "system"
      signer_status:
        | "aguardando"
        | "visualizado"
        | "assinado"
        | "recusado"
        | "expirado"
      signing_mode: "parallel" | "sequential"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "manager", "employee", "viewer"],
      doc_status: [
        "pendente",
        "visualizado",
        "assinado",
        "recusado",
        "expirado",
        "cancelado",
      ],
      event_type: [
        "created",
        "uploaded",
        "sent",
        "email_delivered",
        "opened",
        "viewed",
        "signing_started",
        "signed",
        "declined",
        "expired",
        "cancelled",
        "downloaded",
        "certificate_generated",
        "reminder_sent",
      ],
      field_type: [
        "signature",
        "initial",
        "name",
        "cpf",
        "company",
        "role",
        "date",
        "text",
        "checkbox",
      ],
      history_action: [
        "criado",
        "enviado",
        "visualizado",
        "assinado",
        "recusado",
        "expirado",
        "reenviado",
        "cancelado",
      ],
      notification_type: [
        "document_sent",
        "document_viewed",
        "document_signed",
        "document_declined",
        "document_expired",
        "document_cancelled",
        "reminder",
        "system",
      ],
      signer_status: [
        "aguardando",
        "visualizado",
        "assinado",
        "recusado",
        "expirado",
      ],
      signing_mode: ["parallel", "sequential"],
    },
  },
} as const
