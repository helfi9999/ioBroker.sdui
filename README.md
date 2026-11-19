# ioBroker.sdui

Unofficial community adapter for SDUI school timetables and
school news in ioBroker, including two VIS 2 widgets.

**Version:** 0.6.24
**License:** MIT

> This is an independent community project.
> It is not affiliated with or endorsed by SDUI.

## Features

### Timetable

- Retrieve school timetable data from SDUI.
- Display weekly timetables from Monday to Friday.
- Show subjects, teachers, rooms and lesson times.
- Highlight substitutions and cancelled lessons.
- Configure subject colors and timetable appearance.
- Navigate between available timetable weeks.
- Retrieve future holiday information when provided by SDUI.
- Provide timetable data as ioBroker states, HTML and JSON.

### School news

- Retrieve available SDUI school news.
- Display messages in a VIS 2 dialog.
- Show a news indicator and unread message count.
- Mark individual messages as read.
- Mark all messages as read.

News read-status actions interact with SDUI. Timetable
retrieval is read-only.

## VIS 2 widgets

The adapter includes a widget set named **SDUI Widgets**.

Two widgets are available:

1. **Stundenplan (inventwo-Stil)**
   - Weekly timetable display
   - Configurable appearance

2. **SDUI Logo mit News-Dialog**
   - SDUI logo
   - Unread news indicator
   - News dialog
   - Read-status controls

Both widgets include preview images in the VIS 2 editor.

Legacy widget bundles are retained for compatibility with
existing VIS 2 projects.

## Requirements

- A working ioBroker installation
- A supported Node.js version
- VIS 2 for the included widgets
- An SDUI account with access to school data
- Network connectivity to the SDUI service

Available data and actions depend on the permissions of
the SDUI account and the school's configuration.

## Installation

This project is currently preparing for an official
ioBroker repository release.

GitHub repository:

https://github.com/helfi9999/ioBroker.sdui

Until the adapter has been published on npm and added to
the ioBroker repository, installation is intended for
experienced users testing a community adapter.

Back up your ioBroker installation before installing or
updating a development version.

## Configuration

Open the SDUI adapter settings in ioBroker Admin.

The configuration includes:

- **identifier**: SDUI login identifier
- **password**: SDUI password
- **schoolSearch**: School search input
- **slink**: School selection
- **userId**: User selection
- **intervalMinutes**: Polling interval
- **daysPast**: Past timetable range
- **daysFuture**: Future timetable range

Some settings may require an active SDUI login or school
selection before values become available.

After saving the configuration, verify that the adapter
connects successfully and creates timetable/news states.

Never publish account credentials, authentication tokens
or personal school data.

## ioBroker data points

Examples for the first adapter instance:

### Timetable

- `sdui.0.timetable.weekGrid.html`
- `sdui.0.timetable.weekGrid.json`
- `sdui.0.timetable.weekGrid.navigationHtml`

Additional timetable, substitution and holiday data
points may be available depending on the SDUI response.

### News and controls

- `sdui.0.news.items`
- `sdui.0.news.count`
- `sdui.0.news.unread`
- `sdui.0.news.markRead`
- `sdui.0.news.markAllRead`
- `sdui.0.control.refresh`

Use control states only for their documented actions.

## Privacy and security

This adapter connects to SDUI using the configured account.

- Keep your SDUI credentials private.
- Do not publish ioBroker backups or instance configuration.
- Do not share screenshots containing student information.
- Check your school's rules and applicable privacy
  requirements before displaying school data publicly.
- News read-status actions may modify the read state
  associated with your SDUI account.

No real student data or credentials are included in this
public source repository.

## Development

The adapter source code is located in the project root.
The VIS 2 widget source code is in `src-widgets/`.

Install dependencies and run package tests:

```bash
npm ci
npm run test:package


## Changelog

### **WORK IN PROGRESS**

- Added the official ioBroker release script for automated future releases.

### 0.6.28

- Completed release note translations for all supported languages.


### 0.6.27

- Added missing release notes for version 0.6.26.


### 0.6.26

- Renamed adapter display title to "Sdui" in all supported languages.


### 0.6.25

- Updated Node.js and ioBroker compatibility requirements.
- Added admin translations for eleven languages.
- Improved responsive admin configuration.
- Updated repository metadata, documentation and CI workflow.


### 0.6.24

- Combined SDUI timetable and school news widgets for VIS 2.
- Added preview images for both widgets.
- Retained legacy widget compatibility.


## License

Copyright (c) 2026 helfi9999 helfi9999@gmail.com

MIT License. See [LICENSE](LICENSE).
