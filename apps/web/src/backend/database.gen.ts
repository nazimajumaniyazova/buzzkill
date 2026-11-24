
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "achievements": {
                  Row: {
                    "achievement_id": string,"unlocked_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "achievement_id": string,"unlocked_at": string,"user_id": string
                  }
                  Update: {
                    "achievement_id"?: string,"unlocked_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"id": string,"nickname": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id": string,"nickname": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"nickname"?: string
                  }
                  Relationships: [
                    
                  ]
                },"runs": {
                  Row: {
                    "created_at": string,"daily_date": string | null,"difficulty": Database["public"]['Enums']["difficulty"],"game_version": string,"hero_id": Database["public"]['Enums']["hero_id"],"id": string,"level": number,"mode": Database["public"]['Enums']["run_mode"],"replay": string,"score": number,"seed": number,"speed": number,"state_hash": string,"status": Database["public"]['Enums']["run_status"],"ticks": number,"time_of_day": Database["public"]['Enums']["time_of_day"],"user_id": string,"verified_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"daily_date"?: string | null,"difficulty": Database["public"]['Enums']["difficulty"],"game_version": string,"hero_id": Database["public"]['Enums']["hero_id"],"id"?: string,"level": number,"mode": Database["public"]['Enums']["run_mode"],"replay": string,"score": number,"seed": number,"speed": number,"state_hash": string,"status": Database["public"]['Enums']["run_status"],"ticks": number,"time_of_day": Database["public"]['Enums']["time_of_day"],"user_id": string,"verified_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"daily_date"?: string | null,"difficulty"?: Database["public"]['Enums']["difficulty"],"game_version"?: string,"hero_id"?: Database["public"]['Enums']["hero_id"],"id"?: string,"level"?: number,"mode"?: Database["public"]['Enums']["run_mode"],"replay"?: string,"score"?: number,"seed"?: number,"speed"?: number,"state_hash"?: string,"status"?: Database["public"]['Enums']["run_status"],"ticks"?: number,"time_of_day"?: Database["public"]['Enums']["time_of_day"],"user_id"?: string,"verified_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"suspicious_runs": {
                  Row: {
                    "claimed": NonNullable<Json>,"created_at": string,"found": NonNullable<Json>,"game_version": string,"id": string,"replay": string,"seed": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "claimed": NonNullable<Json>,"created_at"?: string,"found": NonNullable<Json>,"game_version": string,"id"?: string,"replay": string,"seed": number,"user_id": string
                  }
                  Update: {
                    "claimed"?: NonNullable<Json>,"created_at"?: string,"found"?: NonNullable<Json>,"game_version"?: string,"id"?: string,"replay"?: string,"seed"?: number,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "merge_achievements":
{ Args: { "unlocked": Json }; Returns: {
              "achievement_id": string,
"unlocked_at": string,
"user_id": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "achievements"
        isOneToOne: false
        isSetofReturn: true
      } }
          }
          Enums: {
            "difficulty": "easy"|"normal"|"hard","hero_id": "male"|"female"|"sam"|"leo","run_mode": "classic"|"daily","run_status": "won"|"lost","time_of_day": "day"|"night"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "difficulty": ["easy", "normal", "hard"],"hero_id": ["male", "female", "sam", "leo"],"run_mode": ["classic", "daily"],"run_status": ["won", "lost"],"time_of_day": ["day", "night"]
          }
        }
} as const
