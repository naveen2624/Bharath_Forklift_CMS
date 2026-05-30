import { NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createAdminClient,
} from "@/lib/supabase/server";

// POST /api/users — create a new auth user + users table record
export async function POST(request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user: caller },
    } = await supabase.auth.getUser();
    if (!caller)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { name, email, password, role_id, phone } = await request.json();
    if (!name || !email || !password || !role_id)
      return NextResponse.json(
        { error: "name, email, password and role_id are required" },
        { status: 400 },
      );

    const admin = createAdminClient();

    const { data: authData, error: authError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
    if (authError)
      return NextResponse.json({ error: authError.message }, { status: 400 });

    const { data: callerUser } = await supabase
      .from("users")
      .select("id")
      .eq("auth_user_id", caller.id)
      .single();

    const { data: newUser, error: dbError } = await admin
      .from("users")
      .insert({
        auth_user_id: authData.user.id,
        name,
        email,
        role_id,
        phone: phone || null,
        created_by: callerUser?.id || null,
      })
      .select()
      .single();

    if (dbError) {
      await admin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: dbError.message }, { status: 400 });
    }

    return NextResponse.json({ user: newUser }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/users
export async function PATCH(request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user: caller },
    } = await supabase.auth.getUser();
    if (!caller)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, role_id, is_active, name, phone } = await request.json();
    if (!id)
      return NextResponse.json({ error: "id is required" }, { status: 400 });

    const admin = createAdminClient();
    const updates = {};
    if (role_id !== undefined) updates.role_id = role_id;
    if (is_active !== undefined) updates.is_active = is_active;
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;

    const { data, error } = await admin
      .from("users")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error)
      return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ user: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
