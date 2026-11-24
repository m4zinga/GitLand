# GitLand

A Chrome extension that lets you give GitHub your own look: a background image for your profile
and for each of your repositories, plus custom colors for GitHub's interface.

Your theme lives in a GitHub repository called **`background_profile`**. Make it **public** and
everyone with GitLand who visits your profile sees your theme. Make it **private** and only you see it.

Example configuration repository: [m4zinga/background_profile](https://github.com/m4zinga/background_profile)

---

## Installation

1. Download or clone this repository.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the folder that contains `manifest.json`.
4. Pin GitLand to the toolbar to reach the popup quickly.

## Quick start

1. Create a repository named exactly `background_profile` on your account (public or private).
2. Add a `github_customization.json` file to its root:

   ```json
   {
     "profile": {
       "background_image": "https://github.com/YOUR_USER/background_profile/blob/main/bg-profile.jpg?raw=true",
       "style": "https://github.com/YOUR_USER/background_profile/blob/main/style.json?raw=true"
     },
     "repo": {
       "my-project": {
         "background_image": "https://github.com/YOUR_USER/background_profile/blob/main/my-project.webp?raw=true",
         "style": "https://github.com/YOUR_USER/background_profile/blob/main/style_my_project.json?raw=true"
       }
     }
   }
   ```

3. Add the images and the `style.json` files you referenced (see [Style file](#style-file)).
4. Open your GitHub profile. To see an edit right after pushing it, click the
   **reload button** (↻) in the popup.

Templates are in [`assets/configuration_example`](assets/configuration_example).

---

## How a theme is chosen

On each GitHub page, GitLand checks the configuration sources enabled in the popup, **in order**.
The first source that has a `background_profile/github_customization.json` is used.

| Source | Whose configuration | Works with a private repo? |
| --- | --- | --- |
| **Visited account** (`internet`) | The owner of the page you are viewing (`github.com/<owner>/…`) | No. Only public themes are visible to others |
| **My account** (`personal`) | The account you are logged in with | Yes. Requests use your GitHub session |

By default both are on, in the order *Visited account → My account*. So other people's public
themes show on their pages, and your own theme shows everywhere else. Turn a source off by clicking it.
Turn it back on to add it at the end of the list.

Pages that don't belong to an account (`/settings`, `/notifications`, `/explore`, …) have no
"visited account", so only *My account* can apply there.

### Profile vs. repository entries

Inside the chosen configuration:

- On a repository page, GitLand looks for a matching key in `repo` (case-insensitive):
  - `"my-project"`: a repository **of the configuration owner** (`<owner>/my-project`);
  - `"someone/their-project"`: **any** repository, written as `owner/name`.
- If no key matches, or the page isn't a repository, the `profile` entry is used.

Each entry has two optional fields:

| Field | Description |
| --- | --- |
| `background_image` | URL of an image or GIF used as the page background. |
| `style` | URL of a [style file](#style-file) with the colors. |

---

## Style file

A style file is a JSON object with a `color` map from **CSS custom properties** to **CSS colors**:

```json
{
  "color": {
    "--bgColor-overlay": "rgba(0, 15, 61, 0.78)",
    "--bgColor-default": "rgba(1, 0, 56, 0.75)",
    "--bgColor-header": "rgba(0, 20, 102, 0.57)",
    "--borderColor-default": "rgba(0, 157, 255, 1)"
  }
}
```

Any color syntax works (`#0e1a33`, `#0e1a33cc`, `rgb()`, `rgba()`, `hsl()`, named colors).
Invalid entries are ignored and reported in the popup.

### Useful variables

| Variable | What it colors |
| --- | --- |
| `--bgColor-overlay` | Layer drawn over the background image. Use transparency to dim or tint it. *(GitLand)* |
| `--bgColor-header` | Top navigation bar. *(GitLand)* |
| `--bgColor-default` | Main surfaces: page, boxes, cards. Make it semi-transparent to let the image show through. |
| `--bgColor-muted` | Secondary surfaces |
| `--bgColor-inset` | Inset areas such as inputs and sidebars |
| `--borderColor-default`, `--borderColor-muted` | Borders |
| `--control-borderColor-rest` | Borders of form controls |
| `--button-default-bgColor-rest`, `--button-default-borderColor-rest` | Default buttons |
| `--color-calendar-graph-day-L1-bg` … `L4-bg` | Contribution graph levels |
| `--color-calendar-halloween-…`, `--color-calendar-winter-…` | Seasonal contribution graph themes |

The variables not marked *(GitLand)* are GitHub's own
[Primer](https://primer.style/foundations/primitives/color) variables, so other Primer color
variables work too. GitHub may rename them over time.

> **Tip:** the image is only visible where GitHub's surfaces are transparent. If you only see the
> image around the edges, lower the alpha of `--bgColor-default` and `--bgColor-muted`.

---

## The popup

- **Status:** shows whose theme is active on the current tab.
- **Configuration source:** turns the sources on and off and sets their order. Changes are saved
  and applied to open GitHub tabs right away.
- **↻ Reload:** clears GitLand's cache and reloads the configuration. Use it after pushing changes.
- **Live colors:** pick a variable and edit it with the color picker, a hex value and an opacity
  slider. The page updates as you drag.
  - `○` marks variables set by the loaded style, `●` marks variables you edited.
  - Edits stay while you browse, until you reload the page or click **Reset**.
  - **Copy JSON** / **Export style.json** give you a style file to commit to `background_profile`.

---

## Good to know

### Hosting images

GitHub's Content Security Policy only allows images from GitHub's own domains. The simplest
choice is to **put your images in the `background_profile` repository** and link them as
`https://github.com/<you>/background_profile/blob/main/<file>?raw=true`.

Images from other hosts load only if that host allows cross-origin requests (CORS). Otherwise the
popup shows a warning.

### Configuration URLs

- `github_customization.json` is read from the default branch, whatever it is called
  (`main`, `master`, …).
- `style` URLs must point to GitHub: `github.com`, `raw.githubusercontent.com` or
  `gist.githubusercontent.com`. So visiting a profile never contacts third-party servers.

### Caching

Configurations are cached for 10 minutes and refreshed in the background after that. Profiles
without a configuration are remembered too, so GitLand doesn't request them on every visit. Use
**↻ Reload** in the popup to see your changes immediately.

### Privacy

- With **Visited account** on, opening someone's profile or repository downloads their public
  `background_profile/github_customization.json` from GitHub.
- GitLand stores only your source order, the name of the last logged-in account, and the cached
  configurations, all in `chrome.storage.local` on your machine.
- GitLand only runs on `https://github.com/*`.

---

## Project structure

```
manifest.json                  Extension manifest (MV3)
content/contentScript.js       Resolves and applies the theme on GitHub pages
content/contentStyles.css      Background layer and header rules (active only with a theme)
popup/                         Toolbar popup (priorities, live color editor, export)
assets/icons/                  Extension icons
assets/configuration_example/  Templates for github_customization.json and style.json
```

## License

See [LICENSE](LICENSE).
