export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      app_setting: {
        Row: {
          key: string;
          updated_at: string;
          value: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          key: string;
          updated_at?: string;
          value: NonNullable<Json>;
        };
        Update: {
          key?: string;
          updated_at?: string;
          value?: NonNullable<Json>;
        };
        Relationships: [];
      };
      app_user: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          name: string;
          privacy_notice_seen_at: string | null;
          role: Database['public']['Enums']['user_role'];
          status: Database['public']['Enums']['user_status'];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email: string;
          id: string;
          name: string;
          privacy_notice_seen_at?: string | null;
          role?: Database['public']['Enums']['user_role'];
          status?: Database['public']['Enums']['user_status'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          name?: string;
          privacy_notice_seen_at?: string | null;
          role?: Database['public']['Enums']['user_role'];
          status?: Database['public']['Enums']['user_status'];
          updated_at?: string;
        };
        Relationships: [];
      };
      attempt: {
        Row: {
          assignment_id: string | null;
          current_code: string;
          exercise_id: string;
          final_code: string | null;
          finished_at: string | null;
          id: string;
          number: number;
          started_at: string;
          status: Database['public']['Enums']['attempt_status'];
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          assignment_id?: string | null;
          current_code?: string;
          exercise_id: string;
          final_code?: string | null;
          finished_at?: string | null;
          id?: string;
          number?: number;
          started_at?: string;
          status?: Database['public']['Enums']['attempt_status'];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          assignment_id?: string | null;
          current_code?: string;
          exercise_id?: string;
          final_code?: string | null;
          finished_at?: string | null;
          id?: string;
          number?: number;
          started_at?: string;
          status?: Database['public']['Enums']['attempt_status'];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'attempt_assignment_id_fkey';
            columns: ['assignment_id'];
            isOneToOne: false;
            referencedRelation: 'exercise_assignment';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attempt_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercise';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attempt_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'app_user';
            referencedColumns: ['id'];
          },
        ];
      };
      class_block: {
        Row: {
          group_id: string;
          id: string;
          is_hidden: boolean;
          position: number;
          source_locale: Database['public']['Enums']['app_locale'];
          title: string;
          translations: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          group_id: string;
          id?: string;
          is_hidden?: boolean;
          position: number;
          source_locale?: Database['public']['Enums']['app_locale'];
          title: string;
          translations?: NonNullable<Json>;
        };
        Update: {
          group_id?: string;
          id?: string;
          is_hidden?: boolean;
          position?: number;
          source_locale?: Database['public']['Enums']['app_locale'];
          title?: string;
          translations?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: 'class_block_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'class_group';
            referencedColumns: ['id'];
          },
        ];
      };
      class_group: {
        Row: {
          id: string;
          name: string;
          school_year: string;
          subject_id: string;
          teacher_id: string;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          name: string;
          school_year: string;
          subject_id: string;
          teacher_id: string;
        };
        Update: {
          id?: string;
          name?: string;
          school_year?: string;
          subject_id?: string;
          teacher_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'class_group_subject_id_fkey';
            columns: ['subject_id'];
            isOneToOne: false;
            referencedRelation: 'subject';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'class_group_teacher_id_fkey';
            columns: ['teacher_id'];
            isOneToOne: false;
            referencedRelation: 'app_user';
            referencedColumns: ['id'];
          },
        ];
      };
      enrollment: {
        Row: {
          group_id: string;
          id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          group_id: string;
          id?: string;
          user_id: string;
        };
        Update: {
          group_id?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'enrollment_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'class_group';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'enrollment_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'app_user';
            referencedColumns: ['id'];
          },
        ];
      };
      exercise: {
        Row: {
          created_at: string;
          created_by: string;
          difficulty: Database['public']['Enums']['difficulty'];
          function_name: string;
          id: string;
          kind: Database['public']['Enums']['exercise_kind'];
          language: Database['public']['Enums']['exercise_language'];
          max_idle_minutes: number;
          max_repeated_failures: number;
          source_locale: Database['public']['Enums']['app_locale'];
          statement: string;
          title: string;
          topics: string[];
          translations: NonNullable<Json>;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by: string;
          difficulty: Database['public']['Enums']['difficulty'];
          function_name: string;
          id?: string;
          kind?: Database['public']['Enums']['exercise_kind'];
          language?: Database['public']['Enums']['exercise_language'];
          max_idle_minutes?: number;
          max_repeated_failures?: number;
          source_locale?: Database['public']['Enums']['app_locale'];
          statement: string;
          title: string;
          topics?: string[];
          translations?: NonNullable<Json>;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          difficulty?: Database['public']['Enums']['difficulty'];
          function_name?: string;
          id?: string;
          kind?: Database['public']['Enums']['exercise_kind'];
          language?: Database['public']['Enums']['exercise_language'];
          max_idle_minutes?: number;
          max_repeated_failures?: number;
          source_locale?: Database['public']['Enums']['app_locale'];
          statement?: string;
          title?: string;
          topics?: string[];
          translations?: NonNullable<Json>;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'exercise_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'app_user';
            referencedColumns: ['id'];
          },
        ];
      };
      exercise_assignment: {
        Row: {
          block_id: string;
          exercise_id: string;
          group_id: string;
          id: string;
          is_hidden: boolean;
        };
        ComputedFields: never;
        Insert: {
          block_id: string;
          exercise_id: string;
          group_id: string;
          id?: string;
          is_hidden?: boolean;
        };
        Update: {
          block_id?: string;
          exercise_id?: string;
          group_id?: string;
          id?: string;
          is_hidden?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'exercise_assignment_block_fkey';
            columns: ['group_id', 'block_id'];
            isOneToOne: false;
            referencedRelation: 'class_block';
            referencedColumns: ['group_id', 'id'];
          },
          {
            foreignKeyName: 'exercise_assignment_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercise';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'exercise_assignment_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'class_group';
            referencedColumns: ['id'];
          },
        ];
      };
      exercise_subject: {
        Row: {
          exercise_id: string;
          subject_id: string;
        };
        ComputedFields: never;
        Insert: {
          exercise_id: string;
          subject_id: string;
        };
        Update: {
          exercise_id?: string;
          subject_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'exercise_subject_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercise';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'exercise_subject_subject_id_fkey';
            columns: ['subject_id'];
            isOneToOne: false;
            referencedRelation: 'subject';
            referencedColumns: ['id'];
          },
        ];
      };
      process_event: {
        Row: {
          attempt_id: string;
          detail: Json | null;
          id: string;
          received_at: string;
          timestamp: string;
          type: Database['public']['Enums']['process_event_type'];
        };
        ComputedFields: never;
        Insert: {
          attempt_id: string;
          detail?: Json | null;
          id?: string;
          received_at?: string;
          timestamp?: string;
          type: Database['public']['Enums']['process_event_type'];
        };
        Update: {
          attempt_id?: string;
          detail?: Json | null;
          id?: string;
          received_at?: string;
          timestamp?: string;
          type?: Database['public']['Enums']['process_event_type'];
        };
        Relationships: [
          {
            foreignKeyName: 'process_event_attempt_id_fkey';
            columns: ['attempt_id'];
            isOneToOne: false;
            referencedRelation: 'attempt';
            referencedColumns: ['id'];
          },
        ];
      };
      subject: {
        Row: {
          id: string;
          name: string;
          source_locale: Database['public']['Enums']['app_locale'];
          translations: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          name: string;
          source_locale?: Database['public']['Enums']['app_locale'];
          translations?: NonNullable<Json>;
        };
        Update: {
          id?: string;
          name?: string;
          source_locale?: Database['public']['Enums']['app_locale'];
          translations?: NonNullable<Json>;
        };
        Relationships: [];
      };
      test: {
        Row: {
          exercise_id: string;
          expected_output: NonNullable<Json>;
          id: string;
          input: NonNullable<Json>;
          is_hidden: boolean;
          position: number;
        };
        ComputedFields: never;
        Insert: {
          exercise_id: string;
          expected_output: NonNullable<Json>;
          id?: string;
          input: NonNullable<Json>;
          is_hidden?: boolean;
          position: number;
        };
        Update: {
          exercise_id?: string;
          expected_output?: NonNullable<Json>;
          id?: string;
          input?: NonNullable<Json>;
          is_hidden?: boolean;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'test_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercise';
            referencedColumns: ['id'];
          },
        ];
      };
      tutor_interaction: {
        Row: {
          actions: NonNullable<Json>;
          attempt_id: string;
          created_at: string;
          elusion: boolean;
          emotion: Database['public']['Enums']['emotion'];
          hint_level: number;
          id: string;
          intensity: number;
          model: string | null;
          prompt_version: string;
          rejected_answers: number;
          request_id: string | null;
          student_message: string | null;
          transcript: string;
          trigger: Database['public']['Enums']['tutor_trigger'];
        };
        ComputedFields: never;
        Insert: {
          actions?: NonNullable<Json>;
          attempt_id: string;
          created_at?: string;
          elusion?: boolean;
          emotion: Database['public']['Enums']['emotion'];
          hint_level: number;
          id?: string;
          intensity: number;
          model?: string | null;
          prompt_version: string;
          rejected_answers?: number;
          request_id?: string | null;
          student_message?: string | null;
          transcript: string;
          trigger: Database['public']['Enums']['tutor_trigger'];
        };
        Update: {
          actions?: NonNullable<Json>;
          attempt_id?: string;
          created_at?: string;
          elusion?: boolean;
          emotion?: Database['public']['Enums']['emotion'];
          hint_level?: number;
          id?: string;
          intensity?: number;
          model?: string | null;
          prompt_version?: string;
          rejected_answers?: number;
          request_id?: string | null;
          student_message?: string | null;
          transcript?: string;
          trigger?: Database['public']['Enums']['tutor_trigger'];
        };
        Relationships: [
          {
            foreignKeyName: 'tutor_interaction_attempt_id_fkey';
            columns: ['attempt_id'];
            isOneToOne: false;
            referencedRelation: 'attempt';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      can_open_assignment: { Args: { target_assignment_id: string }; Returns: boolean };
      can_read_attempt: { Args: { target_attempt_id: string }; Returns: boolean };
      can_record_event: { Args: { target_attempt_id: string }; Returns: boolean };
      current_app_role: {
        Args: Record<PropertyKey, never>;
        Returns: Database['public']['Enums']['user_role'];
      };
      hidden_test_count: { Args: { target_exercise_id: string }; Returns: number };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_assigned_to_me: { Args: { target_exercise_id: string }; Returns: boolean };
      is_enrolled: { Args: { target_group_id: string }; Returns: boolean };
      is_staff: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_valid_exercise_translations: {
        Args: { source_locale: Database['public']['Enums']['app_locale']; translations: Json };
        Returns: boolean;
      };
      is_valid_text_translations: {
        Args: {
          field: string;
          source_locale: Database['public']['Enums']['app_locale'];
          translations: Json;
        };
        Returns: boolean;
      };
      is_visible_assignment: { Args: { target_assignment_id: string }; Returns: boolean };
      latest_tutor_calls: {
        Args: { max_count: number; since: string; target_user_id: string };
        Returns: string[];
      };
      open_attempt: {
        Args: { attempt_number?: number; target_assignment_id: string };
        Returns: {
          assignment_id: string | null;
          current_code: string;
          exercise_id: string;
          final_code: string | null;
          finished_at: string | null;
          id: string;
          number: number;
          started_at: string;
          status: Database['public']['Enums']['attempt_status'];
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'attempt';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      record_run: {
        Args: {
          new_status: Database['public']['Enums']['attempt_status'];
          ran_code: string;
          run_detail: Json;
          target_attempt_id: string;
        };
        Returns: undefined;
      };
      record_tutor_interaction: {
        Args: {
          answer_actions?: Json;
          answer_elusion: boolean;
          answer_emotion: Database['public']['Enums']['emotion'];
          answer_hint_level: number;
          answer_intensity: number;
          answer_model: string;
          answer_prompt_version: string;
          answer_rejected?: number;
          answer_silent: boolean;
          answer_transcript: string;
          asked_message: string;
          asked_trigger: Database['public']['Enums']['tutor_trigger'];
          target_attempt_id: string;
          target_request_id: string;
        };
        Returns: string;
      };
      retry_attempt: {
        Args: { target_assignment_id: string };
        Returns: {
          assignment_id: string | null;
          current_code: string;
          exercise_id: string;
          final_code: string | null;
          finished_at: string | null;
          id: string;
          number: number;
          started_at: string;
          status: Database['public']['Enums']['attempt_status'];
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'attempt';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      submit_attempt: {
        Args: { target_attempt_id: string };
        Returns: {
          assignment_id: string | null;
          current_code: string;
          exercise_id: string;
          final_code: string | null;
          finished_at: string | null;
          id: string;
          number: number;
          started_at: string;
          status: Database['public']['Enums']['attempt_status'];
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'attempt';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      teaches_group: { Args: { target_group_id: string }; Returns: boolean };
      teaches_student: { Args: { target_user_id: string }; Returns: boolean };
    };
    Enums: {
      app_locale: 'es' | 'en' | 'ca';
      attempt_status: 'in_progress' | 'tests_failed' | 'passed' | 'submitted';
      difficulty: 'initial' | 'medium' | 'advanced' | 'extension';
      emotion: 'joy' | 'surprise' | 'encouragement' | 'celebration';
      exercise_kind: 'code';
      exercise_language: 'javascript';
      process_event_type:
        | 'run'
        | 'submit'
        | 'hint_requested'
        | 'proactive_intervention'
        | 'paste'
        | 'focus_lost'
        | 'focus_gained';
      tutor_trigger: 'question' | 'hint' | 'proactive';
      user_role: 'student' | 'teacher' | 'admin';
      user_status: 'active' | 'disabled';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_locale: ['es', 'en', 'ca'],
      attempt_status: ['in_progress', 'tests_failed', 'passed', 'submitted'],
      difficulty: ['initial', 'medium', 'advanced', 'extension'],
      emotion: ['joy', 'surprise', 'encouragement', 'celebration'],
      exercise_kind: ['code'],
      exercise_language: ['javascript'],
      process_event_type: [
        'run',
        'submit',
        'hint_requested',
        'proactive_intervention',
        'paste',
        'focus_lost',
        'focus_gained',
      ],
      tutor_trigger: ['question', 'hint', 'proactive'],
      user_role: ['student', 'teacher', 'admin'],
      user_status: ['active', 'disabled'],
    },
  },
} as const;
