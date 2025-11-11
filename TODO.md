# TODO

- [ ] verify that `base` is committish
- [ ] --drop-file-changes (since committish)
- [ ] in `performOpDeleteFile`, batch files together by commits - reduce O(N*M) (N=`files.length`, M=`commits[i].length` for file `i`) rebases to O(max(M))
	- [ ] allow specifying `--delete-files nobatch:a,b,c,batch:d,e,f,nobatch:g,h,batch:i,j,j,l`, and/or multiple `--delete-files` flags, for overriding behavior
	- [ ] once becomes default, have separate flag `--[no-]batch-files`, to disable/re-enable for all
- [ ] allow performing "automatable actions", e.g. `:%s/  /\t/g`
- [ ] allow configuring what to do when a commit becomes empty due to our actions
- [ ] `--file-history a,b,c,d` to list file histories
  - [ ] print file, then print list of commits, with extra info (subject, rename info if renamed, etc)
- [ ] integrate range-diff (rebase-diff?)
- [ ] progress-tracking in `.git/reverse-rebase/` dir
  - [ ] allow `--abort`ing to orig if pause/failure
- [ ] op `--rename-file`
- [ ] misc: rename var dropEmpty to dropEmptyCommits
- [ ] misc: rename file operation to op-delete-files (and var performOpDeleteFile to performOpDeleteFiles)
- [ ] fix `--drop-empty` not removing all empty commits
- [ ] 


## another approach

for some tasks, like e.g. applying formatting fixes:
- could we do a regular rebase, on each commit apply the formatting fix via provided command
  - but then on the next commit, if there are merge conflicts, we:
    - disregard the "new_old" state
    - pick the "new" state of the commit (as it was before the rebase), i.e. ignore all previous modifications of the rebase
    - apply the formatting fix

end result would be the same:
- it's safe to disregard the previous modifications of the current rebase (they can be recreated via the cmd)
- so the merge conflicts are avoided
- and the end result is still the desired one:
  - issues are fixes in the correct commits - where they were introduced
  - no merge conflicts

### main take-away

this is possible as long as we don't lose anything by disregarding previous changes of the current rebase (because we can recreate for 0 cost).

### example usage

```sh
EDITOR=true g ri $(g merge-base $(g default-branch-r) HEAD) -x 'make format && make lint-fix && git add . && git commit --amend --no-edit' -X theirs --empty=drop && git sod -w

# g sod -w
# => should be empty - no changes if we exclude whitespace changes.

# EDITOR=true => don't edit the git-rebase-todo
# g ri => rebase -i
# g merge-base => find where we started from current branch to old master. this way we can easily verify that nothing messed up, as we won't included new commits from master in our rebase.
# -X theirs => important. this is what solves merge conflicts - in a new commit, if a merge conflict occurs, it ignores previous changes done where conflicts occurred, and picks theirs (our branch that we're rebasing) implementation. see also `man git-rebase` /MERGE STRATEGIES
# --empty=drop - get rid of commits that have became empty (to not interrupt workflow). if we made a commit that made some fixes, it's likely to become empty, so this will get rid of it
```

### modelling the opposite

if we were to approach this with the original idea (reverse rebase), i believe it doesn't actually guarantee that we won't encounter merge conflicts.
