## Documentation

The current user facing documentation can be found at [sofie.gitbook.io](https://sofie.gitbook.io/sofie-tv-automation/). The documentation for developers (although scarce) can be found in `DOCS.md` or `DEVELOPER.md` in the subfolders of the git project. (Currently in fact so scarce that [meteor/server/api/playout](meteor/server/api/playout/DOCS.md) is the only you will find, work in progress...)

## Git workflow

The team works in sprints of about 4-5 weeks, every sprint a release branch is created. After the sprint the release branch is frozen and tested. When testing is completed the release is finalized and merged to the master branch as well as any newer release branches. If you create any new modifications please target these at the release branch that is currently in development.

## Monorepo layout

This repository is a monorepo and contains both the main application (usually called server-core) as well as multiple auxiliary projects. In the `meteor` folder you will find the main Meteor application with `server` and `client` subfolders for the server-side application and front end. The `packages` folder contains two libraries, `blueprints-integration` and `server-core-integration`, as well as the two main gateways: `playout-gateway` and `mos-gateway`.

## Editing the code

The code is formatted and linted using prettier/eslint. The shared config can be found in the [code-standard-preset](https://github.com/nrkno/tv-automation-sofie-code-standard-preset) project. We recommend using VS code with the Prettier plugin and "format-on-save" enabled.

## Glossary

*Note: this list is not very complete but will be supplemented over time.*

<table class="relative-table wrapped" style="width: 58.5299%;">
<colgroup><col style="width: 22.6079%;"> <col style="width: 77.3921%;"></colgroup> 
<tbody>

<tr>
<th>Term</th>
<th>Meaning</th>
</tr>

<tr>
<td>Auto next</td>
<td>Part with a set duration after which Sofie will automatically take the next part</td>
</tr>

<tr>
<td>Hold</td>
<td>Allows a blueprint developer to extend some pieces into the next part until the user does another take. Can be used to make _J-cuts_.</td>
</tr>

<tr>
<td>Piece or part instance</td>
<td>A copy of the original part or piece that was created just before playback. Can contain timing information and prevents ingest operations from badly affecting parts and pieces on-air</td>
</tr>

</tbody>
</table>