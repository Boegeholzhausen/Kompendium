/**
 * Inter lokal einbinden (vier Schnitte, mehr braucht die Skala nicht).
 *
 * Die Schnitte werden einzeln ueber ihren Unterpfad importiert: der
 * Sammel-Import aus dem Paketwurzel-Index zieht alle achtzehn Schnitte
 * inklusive Kursiven ins Bundle (rund 6 MB), von denen keiner gebraucht wird.
 */
import { useFonts } from 'expo-font';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';

export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  // Bei einem Ladefehler startet die App trotzdem mit der Systemschrift,
  // statt auf dem Splash haengen zu bleiben.
  return loaded || error !== null;
}
