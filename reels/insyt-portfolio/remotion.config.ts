import { Config } from "@remotion/cli/config";

// JPEG nos frames intermediários: o vídeo não tem transparência e renderiza
// bem mais rápido que PNG. CRF 16 mantém os textos finos dos sites nítidos
// depois da recompressão do Instagram.
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
Config.setCodec("h264");
Config.setCrf(16);
Config.setPixelFormat("yuv420p");
