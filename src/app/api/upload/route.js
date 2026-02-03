
import { uploadImage } from "../mediahandler";

export async function POST(req) {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!file) {
    return Response.json({ error: "No file" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const url = await uploadImage({
    data: buffer,
    name: file.name,
    mimetype: file.type
  });

  return Response.json({ success: true, url });
}
