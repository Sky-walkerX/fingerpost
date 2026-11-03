"""Declarative launch and permission boundary checks; physical launch remains acceptance."""
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET

APP = Path(__file__).resolve().parents[1] / 'apps/android/app/src/main'
A = '{http://schemas.android.com/apk/res/android}'

class EntryPointsTest(unittest.TestCase):
    def test_only_system_ui_can_bind_the_tile(self):
        manifest = ET.parse(APP / 'AndroidManifest.xml').getroot()
        tile = manifest.find("application/service[@" + A + "name='.GuidanceTileService']")
        self.assertIsNotNone(tile, 'Quick Settings entry point is missing')
        self.assertEqual(tile.get(A + 'permission'), 'android.permission.BIND_QUICK_SETTINGS_TILE')
        self.assertEqual(tile.get(A + 'exported'), 'true')
        self.assertEqual(tile.find('intent-filter/action').get(A + 'name'), 'android.service.quicksettings.action.QS_TILE')
        self.assertEqual(tile.get(A + 'icon'), '@drawable/ic_guidance')

    def test_launcher_shortcut_uses_explicit_foreground_activity(self):
        manifest = ET.parse(APP / 'AndroidManifest.xml').getroot()
        activity = manifest.find("application/activity[@" + A + "name='.MainActivity']")
        metadata = activity.find("meta-data[@" + A + "name='android.app.shortcuts']")
        self.assertIsNotNone(metadata, 'Static shortcut is missing')
        self.assertEqual(metadata.get(A + 'resource'), '@xml/shortcuts')
        shortcut, = ET.parse(APP / 'res/xml/shortcuts.xml').getroot().findall('shortcut')
        intent = shortcut.find('intent')
        self.assertEqual(intent.get(A + 'targetPackage'), 'io.github.fingerpost')
        self.assertEqual(intent.get(A + 'targetClass'), 'io.github.fingerpost.MainActivity')
        self.assertEqual(intent.get(A + 'action'), 'android.intent.action.VIEW')
        self.assertEqual(shortcut.get(A + 'shortcutShortLabel'), '@string/start_session')
        self.assertEqual(shortcut.get(A + 'enabled'), 'true')

    def test_launch_label_and_monochrome_icon_exist(self):
        for locale in ['values', 'values-hi', 'values-es']:
            labels = ET.parse(APP / f'res/{locale}/strings.xml').getroot()
            self.assertTrue(labels.find("string[@name='start_session']").text)
        icon = APP / 'res/drawable/ic_guidance.xml'
        self.assertTrue(icon.is_file(), 'Tile icon missing')
        self.assertEqual(ET.parse(icon).getroot().tag, 'vector')

if __name__ == '__main__':
    unittest.main()
