import { NextResponse } from "next/server";
import { assertParcelId, parcelExists, readRecords } from "~~/lib/store";

// Serves the hosting member's record files byte for byte. The page hashes them and checks them against Hedera, so this
// route can supply a shipment's details but cannot make a changed record look genuine.
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ parcelId: string }> }) {
  const { parcelId } = await params;
  try {
    assertParcelId(parcelId);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
  if (!parcelExists(parcelId)) {
    return NextResponse.json({ records: [] });
  }
  const records = readRecords(parcelId).map(({ fileName, kind, bytes }) => ({
    fileName,
    kind,
    content: Buffer.from(bytes).toString("base64"),
  }));
  return NextResponse.json({ records });
}
