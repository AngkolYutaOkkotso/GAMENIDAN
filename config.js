/* Fill these in from Supabase -> Project Settings -> API.
   The anon key is SAFE to expose in the browser (Row Level Security protects data).
   Leave the placeholders and the game still works, local-only. */
window.MILO_CONFIG = {
    SUPABASE_URL: "https://damuvbgxmvkuvextkmti.supabase.co",
    SUPABASE_ANON_KEY: "sb_publishable_44sRzjfbSiPG640qJHPC6A_fWBv6rmW",
    ALLOW_GUEST_CLOUD: true,            // guests get a cloud save via anonymous sign-in
    PROVIDERS: ["google", "discord"]    // buttons shown in the account panel
};
