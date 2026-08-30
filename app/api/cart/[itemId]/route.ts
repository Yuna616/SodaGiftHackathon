import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const updateCartItemSchema = z.object({
  quantity: z.number().int().min(1).max(20),
});

export async function PATCH(req: NextRequest, { params }: { params: { itemId: string } }) {
  const body = await req.json().catch(() => null);
  const parsed = updateCartItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("cart_items")
    .update({ quantity: parsed.data.quantity })
    .eq("id", params.itemId)
    .select()
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "CART_ITEM_NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({ item: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: { itemId: string } }) {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("cart_items").delete().eq("id", params.itemId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
