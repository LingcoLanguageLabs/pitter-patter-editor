{
  pkgs,
  lib,
  config,
  ...
}:

let
  # The browsers for packages/shuffle's Playwright suite.
  #
  # `nix-prefetch-url --unpack <chrome url>` for the chrome hash
  # if you get `Executable doesn't exist at .../chromium-<rev>`.
  chromiumVersion = "153.0.8010.12";
  chromiumRevision = "1243";
  ffmpegRevision = "1011";

  playwrightComponents = pkgs.playwright-driver.passthru.components;

  playwrightChromium = playwrightComponents.chromium.overrideAttrs (_: {
    src = pkgs.fetchzip {
      url = "https://cdn.playwright.dev/builds/cft/${chromiumVersion}/linux64/chrome-linux64.zip";
      stripRoot = true;
      hash = "sha256-ORdMu1e4Peolr8rdfvzgeaFhC8RgBipaOsAm7e3ZeqE=";
    };
  });

  playwrightHeadlessShell = playwrightComponents.chromium-headless-shell.overrideAttrs (_: {
    src = pkgs.fetchzip {
      url = "https://cdn.playwright.dev/builds/cft/${chromiumVersion}/linux64/chrome-headless-shell-linux64.zip";
      stripRoot = false;
      hash = "sha256-GLqqZOwtnJig+ZCIT8FYsIxZGSFTmRwLbqNXeSOdJXA=";
    };
  });

  playwrightBrowsers = pkgs.linkFarm "playwright-browsers" [
    {
      name = "chromium-${chromiumRevision}";
      path = playwrightChromium;
    }
    {
      name = "chromium_headless_shell-${chromiumRevision}";
      path = playwrightHeadlessShell;
    }
    {
      name = "ffmpeg-${ffmpegRevision}";
      path = playwrightComponents.ffmpeg;
    }
  ];

  playwrightFonts = pkgs.makeFontsConf {
    fontDirectories = [
      pkgs.noto-fonts
      pkgs.dejavu_fonts
    ];
  };
in
{
  # https://devenv.sh/packages/
  packages = [
    pkgs.git
    pkgs.nil
    playwrightBrowsers
  ];

  # https://devenv.sh/languages/
  languages.javascript = {
    enable = true;
    corepack.enable = true;
  };

  # https://devenv.sh/reference/options/#env
  env = {
    PLAYWRIGHT_BROWSERS_PATH = "${playwrightBrowsers}";
    PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "1";
    PLAYWRIGHT_NODEJS_PATH = "${lib.getExe config.languages.javascript.package}";
    FONTCONFIG_FILE = "${playwrightFonts}";
  };
}
