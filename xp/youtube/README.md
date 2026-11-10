# Video files for the watch page

Each featured video on the homepage looks for a file here named after its id.
Drop one in and it plays; without it the player sits on its loading frame.

| File | Video on the homepage |
|---|---|
| `wilco.mp4` | wilco |
| `house.mp4` | hOUsE DISMOUNT |
| `good.mp4` | Good Times!!! |
| `babyfood.mp4` | Baby Food Eating Contest |
| `carrie.mp4` | carrie chokes the chicken |

No rebuild needed — drop the file in and reload the page.

## Making a clip look like 2005

A modern file will look too clean. YouTube in 2005 transcoded everything to
320x240 Flash video at roughly 250kbps with mono audio, so one ffmpeg pass
gets you most of the way:

    ffmpeg -i input.mp4 \
      -vf "scale=320:240,fps=15" \
      -b:v 250k -ac 1 -b:a 64k \
      -movflags +faststart \
      public/youtube/wilco.mp4

That gives the soft, blocky, slightly smeared look, and the thin tinny sound.

## Where to get clips

- **archive.org** — a large public-domain and Creative Commons collection you
  can download outright. The Prelinger Archives in particular are full of
  footage that already looks the part.
- **Your own footage** — anything shot on an old camcorder or early phone
  needs no processing at all.
- **Wikimedia Commons** — freely licensed video, mostly documentary.
