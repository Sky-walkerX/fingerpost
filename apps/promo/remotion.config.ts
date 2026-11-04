import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setCodec('h264');
const audioOnly = process.argv.some((arg) => ['--codec=wav', '--codec=mp3', '--codec=aac'].includes(arg));
if (!audioOnly) {
  Config.setCrf(16);
  Config.setPixelFormat('yuv420p');
}
