import { NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createAdminClient,
} from "@/lib/supabase/server";

export async function POST(request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file");
    const bucket = formData.get("bucket") || "uploads";
    const path = formData.get("path") || `${Date.now()}_${file.name}`;

    if (!file)
      return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const admin = createAdminClient();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error } = await admin.storage.from(bucket).upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    });
    if (error)
      return NextResponse.json({ error: error.message }, { status: 400 });

    const {
      data: { publicUrl },
    } = admin.storage.from(bucket).getPublicUrl(path);
    return NextResponse.json({ url: publicUrl, path });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
