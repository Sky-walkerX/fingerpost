import base64
import json
import unittest
from unittest.mock import patch

from sensory_tts import synthesize


class SensoryTtsTest(unittest.TestCase):
    def test_direction_is_metadata_and_only_verbatim_copy_is_spoken(self):
        captured = []

        class Response:
            def __enter__(self):
                return self

            def __exit__(self, *args):
                pass

            def read(self):
                return json.dumps({'candidates': [{'content': {'parts': [{'inlineData': {
                    'data': base64.b64encode(b'RIFF-synthetic').decode(), 'mimeType': 'audio/wav',
                }}]}}]}).encode()

        def open_request(request, timeout):
            captured.append(request)
            return Response()

        with patch('sensory_tts.token', return_value='synthetic'), patch('sensory_tts.urllib.request.urlopen', side_effect=open_request):
            audio, mime = synthesize('synthetic-project', 'clear and brisk', 'Kore', 'Press now.')
        self.assertEqual((audio, mime), (b'RIFF-synthetic', 'audio/wav'))
        body = json.loads(captured[0].data)
        part = body['contents'][0]['parts'][0]
        self.assertEqual(part, {'text': 'Press now.', 'speechMetadata': {'style': 'clear and brisk'}})
        self.assertEqual(body['generationConfig']['speechConfig']['voiceConfig'], {'voice': 'Kore'})
        self.assertIn('/gemini-3.8-flash-tts:generateContent', captured[0].full_url)


if __name__ == '__main__':
    unittest.main()
