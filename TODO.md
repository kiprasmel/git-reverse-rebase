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
