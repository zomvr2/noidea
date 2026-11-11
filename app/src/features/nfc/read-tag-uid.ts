import { normalizeTagUid } from "@noidea/shared";
import NfcManager, { NfcTech } from "react-native-nfc-manager";

/**
 * Lee el UID de la etiqueta del dispensador (tarjeta/llavero RFID del kit, 13,56 MHz).
 * Android: NfcA cubre MIFARE Classic y NTAG. iPhone no lee MIFARE Classic (usar NTAG21x).
 * Requiere development build: no funciona en Expo Go.
 */
export async function readTagUid(): Promise<string> {
  const supported = await NfcManager.isSupported();
  if (!supported) throw new Error("Este teléfono no tiene NFC.");
  await NfcManager.start();
  if (!(await NfcManager.isEnabled())) throw new Error("Activa el NFC en los ajustes del teléfono.");

  try {
    await NfcManager.requestTechnology([NfcTech.NfcA, NfcTech.Ndef], {
      alertMessage: "Acerca el teléfono a la etiqueta del estanque",
    });
    const tag = await NfcManager.getTag();
    if (!tag?.id) throw new Error("No se pudo leer el identificador de la etiqueta.");
    return normalizeTagUid(tag.id);
  } finally {
    await NfcManager.cancelTechnologyRequest().catch(() => undefined);
  }
}

export function cancelTagRead() {
  void NfcManager.cancelTechnologyRequest().catch(() => undefined);
}
