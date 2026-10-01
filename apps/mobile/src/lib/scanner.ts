/**
 * Lecture QR :
 * - mobile : ML Kit (scanner natif plein écran, format QR uniquement) ;
 * - navigateur (développement) : caméra + jsQR, voir `WebScanner.vue`.
 */
import { BarcodeFormat, BarcodeScanner } from "@capacitor-mlkit/barcode-scanning";
import { Capacitor } from "@capacitor/core";

export const isNative = () => Capacitor.isNativePlatform();

export async function prepareNativeScanner(): Promise<void> {
  const { supported } = await BarcodeScanner.isSupported();
  if (!supported) throw new Error("Lecture de QR non prise en charge sur cet appareil.");
  const permission = await BarcodeScanner.checkPermissions();
  if (permission.camera !== "granted") {
    const asked = await BarcodeScanner.requestPermissions();
    if (asked.camera !== "granted") throw new Error("Accès à la caméra refusé.");
  }
  if (Capacitor.getPlatform() === "android") {
    const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
    if (!available) await BarcodeScanner.installGoogleBarcodeScannerModule();
  }
}

/** Ouvre le scanner natif ; renvoie le contenu brut ou `null` si annulé. */
export async function scanNative(): Promise<string | null> {
  const { barcodes } = await BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode] });
  return barcodes[0]?.rawValue ?? null;
}
